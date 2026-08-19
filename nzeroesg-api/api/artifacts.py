"""Bounded workspace artifact catalog API."""

from __future__ import annotations

from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from api.workspaces import require_workspace_principal
from config import database_url_for_runtime, settings, validate_artifact_storage_runtime
from domain.artifacts.models import Artifact, ArtifactKind, ArtifactSourceType, ArtifactStatus
from domain.artifacts.storage import (
    ArtifactStorageBudgetExceededError,
    ArtifactStorageNotFoundError,
    ArtifactStoragePolicy,
    ArtifactStorageProviderError,
    SourceRetention,
)
from domain.demo_data import generated_demo_source
from domain.workspaces.principals import WorkspacePrincipal
from integrations.aws_s3 import S3ObjectStore
from persistence.artifact_storage import build_artifact_storage_repository
from persistence.artifacts import (
    ArtifactNotFoundError,
    build_artifact_repository,
    build_report_snapshot_repository,
)
from services.artifact_storage import ArtifactStorageService

artifacts_router = APIRouter(prefix="/artifacts", tags=["artifacts"])
artifact_repository = build_artifact_repository(database_url_for_runtime())
report_snapshot_repository = build_report_snapshot_repository(database_url_for_runtime())
validate_artifact_storage_runtime()
artifact_storage_policy = ArtifactStoragePolicy(
    max_active_storage_bytes=settings.artifact_storage_max_active_bytes,
    max_workspace_storage_bytes=settings.artifact_storage_max_workspace_bytes,
    max_write_requests_per_month=settings.artifact_storage_max_write_requests,
    max_read_requests_per_month=settings.artifact_storage_max_read_requests,
    max_egress_bytes_per_month=settings.artifact_storage_max_egress_bytes,
    retention_hours=settings.artifact_storage_retention_hours,
)
artifact_storage_repository = build_artifact_storage_repository(database_url_for_runtime())
artifact_object_store = (
    S3ObjectStore(bucket=settings.aws_s3_bucket or "", region=settings.aws_s3_region)
    if settings.artifact_storage_enabled
    else None
)
artifact_storage_service = ArtifactStorageService(
    enabled=settings.artifact_storage_enabled,
    repository=artifact_storage_repository,
    policy=artifact_storage_policy,
    object_store=artifact_object_store,
    bucket=settings.aws_s3_bucket or "",
)


class ArtifactResponse(BaseModel):
    artifact_id: str
    workspace_id: str
    kind: ArtifactKind
    title: str
    status: ArtifactStatus
    source_type: ArtifactSourceType
    source_reference: str | None
    media_type: str | None
    content_sha256: str | None
    version: int
    metadata: dict[str, Any]
    created_by: str
    created_at: str
    updated_at: str
    deleted_at: str | None


class ArtifactListResponse(BaseModel):
    artifacts: list[ArtifactResponse]


class ArtifactRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


def artifact_response(artifact: Artifact) -> ArtifactResponse:
    return ArtifactResponse.model_validate(artifact.to_dict())


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Artifact was not found in this workspace.",
    )


def _storage_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, ArtifactStorageBudgetExceededError):
        return HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=(
                "The monthly artifact-retention safety limit has been reached. "
                "The source file was not stored."
            ),
        )
    if isinstance(exc, ArtifactStorageNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Retained source content is unavailable or has expired.",
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Private artifact source storage is temporarily unavailable.",
    )


async def retain_artifact_source(
    artifact: Artifact,
    content: bytes,
    *,
    workspace_expires_at: int,
) -> SourceRetention:
    try:
        return await run_in_threadpool(
            artifact_storage_service.retain,
            artifact,
            content,
            workspace_expires_at=workspace_expires_at,
        )
    except (
        ArtifactStorageBudgetExceededError,
        ArtifactStorageNotFoundError,
        ArtifactStorageProviderError,
    ) as exc:
        raise _storage_exception(exc) from exc


async def schedule_artifact_source_delete(workspace_id: str, artifact_id: str) -> bool:
    return await run_in_threadpool(
        artifact_storage_service.schedule_delete,
        workspace_id,
        artifact_id,
    )


@artifacts_router.get("", response_model=ArtifactListResponse)
async def list_artifacts(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ArtifactListResponse:
    return ArtifactListResponse(
        artifacts=[
            artifact_response(artifact)
            for artifact in artifact_repository.list_for_workspace(principal.workspace_id)
        ]
    )


@artifacts_router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ArtifactResponse:
    artifact = artifact_repository.get(principal.workspace_id, artifact_id)
    if artifact is None:
        raise _not_found()
    return artifact_response(artifact)


@artifacts_router.get("/{artifact_id}/content")
async def download_artifact_source(
    artifact_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> Response:
    artifact = artifact_repository.get(principal.workspace_id, artifact_id)
    if artifact is None:
        raise _not_found()
    demo_asset = artifact.metadata.get("demo_asset")
    generated_source = generated_demo_source(demo_asset) if isinstance(demo_asset, str) else None
    if generated_source is not None:
        _, media_type, content = generated_source
        encoded_filename = quote(artifact.title, safe="")
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                "Cache-Control": "private, no-store",
                "X-Content-SHA256": artifact.content_sha256 or "",
            },
        )
    try:
        source, content = await run_in_threadpool(
            artifact_storage_service.download,
            principal.workspace_id,
            artifact_id,
        )
    except (
        ArtifactStorageBudgetExceededError,
        ArtifactStorageNotFoundError,
        ArtifactStorageProviderError,
    ) as exc:
        raise _storage_exception(exc) from exc
    encoded_filename = quote(artifact.title, safe="")
    return Response(
        content=content,
        media_type=source.media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Cache-Control": "private, no-store",
            "X-Content-SHA256": source.content_sha256,
        },
    )


@artifacts_router.patch("/{artifact_id}", response_model=ArtifactResponse)
async def rename_artifact(
    artifact_id: str,
    payload: ArtifactRenameRequest,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ArtifactResponse:
    try:
        artifact = artifact_repository.rename(
            principal.workspace_id,
            artifact_id,
            payload.title,
        )
    except (ArtifactNotFoundError, ValueError) as exc:
        if isinstance(exc, ArtifactNotFoundError):
            raise _not_found() from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return artifact_response(artifact)


@artifacts_router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> Response:
    artifact = artifact_repository.get(principal.workspace_id, artifact_id)
    if artifact is None:
        raise _not_found()

    await schedule_artifact_source_delete(principal.workspace_id, artifact_id)
    artifact_repository.soft_delete(principal.workspace_id, artifact_id)

    # Imports are intentionally local: the API modules share repository instances,
    # while persistence modules remain independent of FastAPI and each other.
    if artifact.kind is ArtifactKind.SHIPMENT_DATASET:
        from api.shipments import shipment_repository

        shipment_repository.delete_for_artifact(principal.workspace_id, artifact_id)
    elif artifact.kind is ArtifactKind.EVIDENCE_DOCUMENT:
        from api.evidence import evidence_repository

        evidence_repository.delete_for_artifact(principal.workspace_id, artifact_id)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
