"""Printable report preview and CSV export over typed workspace state."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import time
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from api.artifacts import (
    ArtifactResponse,
    artifact_repository,
    artifact_response,
    report_snapshot_repository,
)
from api.evidence import evidence_repository
from api.shipments import shipment_repository
from api.workspaces import require_workspace_principal
from domain.artifacts.models import (
    ArtifactKind,
    ArtifactSourceType,
    ReportSnapshot,
    create_artifact,
)
from domain.scenarios.comparison import compare_shipment_modes
from domain.shipments.analysis import analyze_shipments
from domain.workspaces.principals import WorkspacePrincipal

reports_router = APIRouter(prefix="/reports", tags=["reports"])


class ReportResponse(BaseModel):
    workspace_id: str
    generated_at: int
    shipment_analysis: dict[str, object]
    scenario: dict[str, object] | None
    suppliers: list[dict[str, object]]
    methodology: dict[str, object]


class ReportSnapshotRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    alternative_mode: str | None = Field(default=None, max_length=30)


class ReportSnapshotResponse(BaseModel):
    artifact: ArtifactResponse
    schema_version: str
    report: ReportResponse


def _build_report(workspace_id: str, alternative_mode: str | None) -> ReportResponse:
    shipments = shipment_repository.list_for_workspace(workspace_id)
    analysis = analyze_shipments(shipments)
    scenario = None
    if alternative_mode:
        try:
            scenario = compare_shipment_modes(
                shipments,
                alternative_mode=alternative_mode,
            ).to_dict()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc
    return ReportResponse(
        workspace_id=workspace_id,
        generated_at=int(time.time()),
        shipment_analysis=analysis.to_dict(),
        scenario=scenario,
        suppliers=[
            supplier.to_dict() for supplier in evidence_repository.list_suppliers(workspace_id)
        ],
        methodology={
            "factor_source": analysis.factor_source,
            "factor_version": analysis.factor_version,
            "factor_applicability": analysis.factor_applicability,
            "assumptions": list(analysis.assumptions),
            "warnings": list(analysis.warnings),
        },
    )


@reports_router.get("/preview", response_model=ReportResponse)
async def report_preview(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
    alternative_mode: Annotated[str | None, Query(max_length=30)] = None,
) -> ReportResponse:
    return _build_report(principal.workspace_id, alternative_mode)


@reports_router.post(
    "/snapshots",
    response_model=ReportSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_report_snapshot(
    payload: ReportSnapshotRequest,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ReportSnapshotResponse:
    report = _build_report(principal.workspace_id, payload.alternative_mode)
    if report.shipment_analysis.get("shipment_count", 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A report snapshot requires an active shipment dataset.",
        )
    serialized = report.model_dump(mode="json")
    digest = hashlib.sha256(
        json.dumps(serialized, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).hexdigest()
    title = (payload.title.strip() if payload.title else None) or datetime.fromtimestamp(
        report.generated_at, UTC
    ).strftime("Decision report · %Y-%m-%d %H:%M UTC")
    artifact = create_artifact(
        workspace_id=principal.workspace_id,
        kind=ArtifactKind.REPORT_SNAPSHOT,
        title=title,
        source_type=ArtifactSourceType.GENERATED,
        source_reference=(
            f"alternative_mode={payload.alternative_mode}" if payload.alternative_mode else None
        ),
        media_type="application/vnd.carbonsage.report+json",
        content_sha256=digest,
        created_by=principal.subject,
    )
    artifact_repository.create(artifact)
    try:
        report_snapshot_repository.store(
            ReportSnapshot(
                artifact_id=artifact.artifact_id,
                workspace_id=principal.workspace_id,
                schema_version="1.0",
                payload=serialized,
                generated_at=datetime.fromtimestamp(report.generated_at, UTC),
            )
        )
        artifact = artifact_repository.mark_ready(
            principal.workspace_id,
            artifact.artifact_id,
            {
                "shipment_count": report.shipment_analysis.get("shipment_count", 0),
                "supplier_count": len(report.suppliers),
                "alternative_mode": payload.alternative_mode,
            },
        )
    except Exception:
        artifact_repository.mark_failed(principal.workspace_id, artifact.artifact_id)
        raise
    return ReportSnapshotResponse(
        artifact=artifact_response(artifact),
        schema_version="1.0",
        report=report,
    )


@reports_router.get("/snapshots/{artifact_id}", response_model=ReportSnapshotResponse)
async def get_report_snapshot(
    artifact_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ReportSnapshotResponse:
    artifact = artifact_repository.get(principal.workspace_id, artifact_id)
    snapshot = report_snapshot_repository.get(principal.workspace_id, artifact_id)
    if artifact is None or artifact.kind is not ArtifactKind.REPORT_SNAPSHOT or snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report snapshot was not found in this workspace.",
        )
    return ReportSnapshotResponse(
        artifact=artifact_response(artifact),
        schema_version=snapshot.schema_version,
        report=ReportResponse.model_validate(snapshot.payload),
    )


def _safe_csv_cell(value: object) -> str:
    text = str(value)
    if text.startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


@reports_router.get("/export.csv")
async def report_csv(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
    alternative_mode: Annotated[str | None, Query(max_length=30)] = None,
) -> Response:
    report = _build_report(principal.workspace_id, alternative_mode)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(("section", "field", "value"))
    writer.writerow(("report", "workspace_id", _safe_csv_cell(report.workspace_id)))
    writer.writerow(("report", "generated_at", report.generated_at))
    for field, value in report.shipment_analysis.items():
        if isinstance(value, dict | list):
            continue
        writer.writerow(("shipment_analysis", field, _safe_csv_cell(value)))
    for mode, breakdown in report.shipment_analysis.get("mode_breakdown", {}).items():
        for field, value in breakdown.items():
            writer.writerow((f"mode:{mode}", field, _safe_csv_cell(value)))
    if report.scenario:
        for field, value in report.scenario.items():
            if isinstance(value, dict | list):
                continue
            writer.writerow(("scenario", field, _safe_csv_cell(value)))
    for supplier in report.suppliers:
        writer.writerow(("supplier", "name", _safe_csv_cell(supplier["name"])))
        writer.writerow(("supplier", "region", _safe_csv_cell(supplier["region"])))
        writer.writerow(("supplier", "document_count", supplier["document_count"]))
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=carbonsage-report.csv"},
    )
