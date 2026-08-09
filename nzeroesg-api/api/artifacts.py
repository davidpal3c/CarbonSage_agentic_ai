"""Bounded workspace artifact catalog API."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from api.workspaces import require_workspace_principal
from config import database_url_for_runtime
from domain.artifacts.models import Artifact, ArtifactKind, ArtifactSourceType, ArtifactStatus
from domain.workspaces.principals import WorkspacePrincipal
from persistence.artifacts import (
    ArtifactNotFoundError,
    build_artifact_repository,
    build_report_snapshot_repository,
)

artifacts_router = APIRouter(prefix="/artifacts", tags=["artifacts"])
artifact_repository = build_artifact_repository(database_url_for_runtime())
report_snapshot_repository = build_report_snapshot_repository(database_url_for_runtime())


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
