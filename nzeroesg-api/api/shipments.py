"""Typed HTTP boundary for bounded shipment spreadsheet ingestion."""

import csv
import io
from datetime import date
from hashlib import sha256
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel

from api.artifacts import (
    ArtifactResponse,
    artifact_repository,
    artifact_response,
    retain_artifact_source,
    schedule_artifact_source_delete,
)
from api.workspaces import require_workspace_principal, workspace_repository
from config import database_url_for_runtime
from domain.artifacts.models import Artifact, ArtifactKind, ArtifactSourceType, create_artifact
from domain.emissions.modes import normalize_mode
from domain.shipments.analysis import AnalyticsGranularity, ShipmentAnalysis, analyze_shipments
from domain.shipments.ingestion import (
    ALLOWED_CONTENT_TYPES,
    ALLOWED_EXTENSIONS,
    EXPORT_HEADERS,
    MAX_FILE_BYTES,
    parse_shipments_document,
)
from domain.shipments.models import NormalizedShipment
from domain.workspaces.principals import WorkspacePrincipal
from persistence.shipments import build_shipment_repository
from persistence.workspaces import QuotaExceededError, WorkspaceNotFoundError

shipments_router = APIRouter(prefix="/shipments", tags=["shipments"])
shipment_repository = build_shipment_repository(database_url_for_runtime())


class ShipmentErrorResponse(BaseModel):
    row_number: int | None
    field: str | None
    message: str


class ShipmentRowResponse(BaseModel):
    shipment_id: str
    shipment_date: date | None
    origin: str
    destination: str
    weight_kg: float
    distance_km: float
    transport_method: str
    source_row: int


class ModeBreakdownResponse(BaseModel):
    shipment_count: int
    weight_kg: float
    emissions_kg: float


class HotspotResponse(BaseModel):
    shipment_id: str
    shipment_date: date | None
    origin: str
    destination: str
    transport_method: str
    emissions_kg: float


class ShipmentPeriodResponse(BaseModel):
    period: str
    period_start: date | None
    shipment_count: int
    weight_kg: float
    emissions_kg: float
    mode_emissions_kg: dict[str, float]


class ShipmentFiltersResponse(BaseModel):
    granularity: Literal["month", "year"]
    start_date: date | None
    end_date: date | None
    modes: list[str]


class AvailableShipmentFiltersResponse(BaseModel):
    start_date: date | None
    end_date: date | None
    modes: list[str]


class ShipmentAnalysisResponse(BaseModel):
    shipment_count: int
    workspace_shipment_count: int
    filtered_out_count: int
    undated_shipment_count: int
    total_weight_kg: float
    total_emissions_kg: float
    total_emissions_tonnes: float
    mode_breakdown: dict[str, ModeBreakdownResponse]
    timeline: list[ShipmentPeriodResponse]
    hotspots: list[HotspotResponse]
    filters: ShipmentFiltersResponse
    available_filters: AvailableShipmentFiltersResponse
    warnings: list[str]
    factor_source: str
    factor_version: str
    factor_applicability: str
    assumptions: list[str]


class ShipmentUploadResponse(BaseModel):
    artifact: ArtifactResponse | None
    accepted_rows: int
    errors: list[ShipmentErrorResponse]
    warnings: list[str]
    rows: list[ShipmentRowResponse]
    analysis: ShipmentAnalysisResponse


def _analysis_response(analysis: ShipmentAnalysis) -> ShipmentAnalysisResponse:
    return ShipmentAnalysisResponse.model_validate(analysis.to_dict())


def _shipment_response(shipment: NormalizedShipment) -> ShipmentRowResponse:
    return ShipmentRowResponse.model_validate(shipment.to_dict())


def _response(
    rows: tuple[NormalizedShipment, ...],
    *,
    artifact: Artifact | None = None,
    errors: tuple[dict[str, object], ...] = (),
    warnings: tuple[str, ...] = (),
) -> ShipmentUploadResponse:
    analysis = analyze_shipments(rows, parser_warnings=warnings)
    return ShipmentUploadResponse(
        artifact=artifact_response(artifact) if artifact else None,
        accepted_rows=len(rows),
        errors=[ShipmentErrorResponse.model_validate(error) for error in errors],
        warnings=list(analysis.warnings),
        rows=[_shipment_response(row) for row in rows],
        analysis=_analysis_response(analysis),
    )


def _consume_analysis_run(workspace_id: str) -> None:
    try:
        workspace_repository.consume_quota(workspace_id, "analysis_runs_per_day")
    except WorkspaceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The workspace session is no longer active.",
        ) from exc
    except QuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The daily analysis quota for this workspace has been reached.",
        ) from exc


def _normalize_analytics_modes(values: list[str] | None) -> tuple[str, ...]:
    normalized: list[str] = []
    for value in values or []:
        try:
            mode = normalize_mode(value).value
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported transport mode: {value}.",
            ) from exc
        if mode not in normalized:
            normalized.append(mode)
    return tuple(normalized)


@shipments_router.post("/upload", response_model=ShipmentUploadResponse)
async def upload_shipments(
    file: Annotated[UploadFile, File(description="A shipment CSV or XLSX workbook")],
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ShipmentUploadResponse:
    media_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if media_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File must use a CSV- or XLSX-compatible content type.",
        )
    suffix = (
        "." + file.filename.rsplit(".", 1)[-1].casefold()
        if file.filename and "." in file.filename
        else ""
    )
    if not file.filename or suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File name must end with .csv or .xlsx.",
        )
    if len(file.filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File name must contain at most 255 characters.",
        )
    content = await file.read(MAX_FILE_BYTES + 1)
    parsed = parse_shipments_document(
        content,
        content_type=media_type,
        filename=file.filename,
    )
    artifact = None
    if parsed.rows:
        _consume_analysis_run(principal.workspace_id)
        prior_shipments = tuple(
            item
            for item in artifact_repository.list_for_workspace(principal.workspace_id)
            if item.kind is ArtifactKind.SHIPMENT_DATASET
        )
        artifact = create_artifact(
            workspace_id=principal.workspace_id,
            kind=ArtifactKind.SHIPMENT_DATASET,
            title=file.filename,
            source_type=ArtifactSourceType.LOCAL_UPLOAD,
            source_reference=file.filename,
            media_type=media_type,
            content_sha256=sha256(content).hexdigest(),
            created_by=principal.subject,
        )
        artifact_repository.create(artifact)
        try:
            source_retention = await retain_artifact_source(
                artifact,
                content,
                workspace_expires_at=principal.expires_at,
            )
            shipment_repository.replace_for_workspace(
                principal.workspace_id,
                artifact.artifact_id,
                parsed.rows,
            )
            artifact = artifact_repository.mark_ready(
                principal.workspace_id,
                artifact.artifact_id,
                {
                    "accepted_rows": len(parsed.rows),
                    "validation_error_count": len(parsed.errors),
                    "warning_count": len(parsed.warnings),
                    "source_retention": source_retention.to_dict(),
                },
            )
            for prior in prior_shipments:
                await schedule_artifact_source_delete(
                    principal.workspace_id,
                    prior.artifact_id,
                )
            artifact_repository.soft_delete_other_ready_shipments(
                principal.workspace_id,
                artifact.artifact_id,
            )
        except Exception:
            await schedule_artifact_source_delete(
                principal.workspace_id,
                artifact.artifact_id,
            )
            artifact_repository.mark_failed(principal.workspace_id, artifact.artifact_id)
            raise
    return _response(
        parsed.rows,
        artifact=artifact,
        errors=tuple(error.to_dict() for error in parsed.errors),
        warnings=parsed.warnings,
    )


@shipments_router.get("", response_model=ShipmentUploadResponse)
async def list_shipments(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ShipmentUploadResponse:
    rows = shipment_repository.list_for_workspace(principal.workspace_id)
    artifact = next(
        (
            item
            for item in artifact_repository.list_for_workspace(principal.workspace_id)
            if item.kind is ArtifactKind.SHIPMENT_DATASET
        ),
        None,
    )
    return _response(rows, artifact=artifact)


@shipments_router.get("/analytics", response_model=ShipmentAnalysisResponse)
async def shipment_analytics(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
    granularity: Annotated[AnalyticsGranularity, Query()] = "month",
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    mode: Annotated[list[str] | None, Query()] = None,
) -> ShipmentAnalysisResponse:
    """Return one deterministic analytics contract shared by every client surface."""

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The analytics start date must not follow the end date.",
        )
    analysis = analyze_shipments(
        shipment_repository.list_for_workspace(principal.workspace_id),
        start_date=start_date,
        end_date=end_date,
        modes=_normalize_analytics_modes(mode),
        granularity=granularity,
    )
    return _analysis_response(analysis)


@shipments_router.get("/export")
async def export_shipments(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> Response:
    """Export normalized rows in a format that can be imported again."""

    rows = shipment_repository.list_for_workspace(principal.workspace_id)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(EXPORT_HEADERS)
    for row in rows:
        writer.writerow(
            (
                row.shipment_id,
                row.shipment_date.isoformat() if row.shipment_date else "",
                row.origin,
                row.destination,
                row.weight_kg,
                "kg",
                row.distance_km,
                "km",
                row.transport_method,
            )
        )
    filename = quote("carbonsage-shipments.csv", safe="")
    return Response(
        content=output.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "Cache-Control": "private, no-store",
        },
    )


@shipments_router.get("/template")
async def shipment_template(
    _principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> Response:
    """Return a small XLSX template that makes the accepted fields explicit."""

    from openpyxl import Workbook

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Shipments"
    worksheet.append(EXPORT_HEADERS)
    worksheet.append(
        (
            "EXAMPLE-001",
            "2026-01-15",
            "Edmonton",
            "Calgary",
            1,
            "mt",
            300,
            "km",
            "truck",
        )
    )
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    filename = quote("carbonsage-shipment-template.xlsx", safe="")
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "Cache-Control": "private, no-store",
        },
    )
