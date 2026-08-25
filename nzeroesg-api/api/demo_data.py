"""Idempotent first-run data for the public CarbonSage workspace."""

from __future__ import annotations

import logging
from hashlib import sha256
from time import perf_counter
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from api.artifacts import artifact_repository, schedule_artifact_source_delete
from api.evidence import (
    _index_document,
    evidence_repository,
    supplier_availability_repository,
)
from api.shipments import shipment_repository
from api.workspaces import require_workspace_principal
from config import database_url_for_runtime
from domain.artifacts.models import (
    ArtifactKind,
    ArtifactSourceType,
    ArtifactStatus,
    create_artifact,
)
from domain.artifacts.storage import SourceRetention
from domain.demo_data import (
    DEMO_EVIDENCE_SOURCES,
    DEMO_SHIPMENTS_CSV,
    DEMO_SHIPMENTS_FILENAME,
    DEMO_SUPPLIER_SERVICE_LANES,
    DEMO_SUPPLIERS,
)
from domain.evidence.ingestion import extract_evidence, normalize_supplier_metadata
from domain.evidence.models import SupplierMetadata
from domain.shipments.ingestion import parse_shipments_csv
from domain.workspaces.principals import WorkspacePrincipal
from persistence.demo_seed import PreparedEvidenceSeed, build_demo_data_seeder

demo_data_router = APIRouter(prefix="/demo/data", tags=["workspace"])
logger = logging.getLogger(__name__)
process_started_at = perf_counter()
generated_source_retention = SourceRetention(status="ephemeral").to_dict()
DEMO_ASSET_KEYS = {
    "shipment-baseline",
    *(source.key for source in DEMO_EVIDENCE_SOURCES),
}
demo_data_seeder = build_demo_data_seeder(database_url_for_runtime())


class DemoLoadPerformance(BaseModel):
    outcome: str
    process_state: str
    process_age_ms: int
    total_ms: int
    stages_ms: dict[str, int]


class DemoDataResponse(BaseModel):
    loaded: bool
    has_artifacts: bool
    artifact_count: int
    shipment_count: int
    supplier_count: int
    evidence_document_count: int
    performance: DemoLoadPerformance | None = None


def _elapsed_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1_000))


def _record_load_performance(
    *,
    response: Response,
    workspace_id: str,
    outcome: str,
    request_started_at: float,
    stages_ms: dict[str, int],
    state: DemoDataResponse,
) -> DemoDataResponse:
    process_age_ms = _elapsed_ms(process_started_at)
    performance = DemoLoadPerformance(
        outcome=outcome,
        process_state=("recent_start" if process_age_ms < 120_000 else "warm_process"),
        process_age_ms=process_age_ms,
        total_ms=_elapsed_ms(request_started_at),
        stages_ms=stages_ms,
    )
    response.headers["Server-Timing"] = ", ".join(
        [f"{name};dur={duration}" for name, duration in stages_ms.items()]
        + [f"total;dur={performance.total_ms}"]
    )
    response.headers["X-CarbonSage-Demo-Load-Outcome"] = outcome
    logger.info(
        "demo_data_load_completed workspace_id=%s outcome=%s process_state=%s "
        "process_age_ms=%s total_ms=%s stages_ms=%s",
        workspace_id,
        outcome,
        performance.process_state,
        performance.process_age_ms,
        performance.total_ms,
        performance.stages_ms,
    )
    return state.model_copy(update={"performance": performance})


def _workspace_state(workspace_id: str) -> DemoDataResponse:
    artifacts = artifact_repository.list_for_workspace(workspace_id)
    shipments = shipment_repository.list_for_workspace(workspace_id)
    suppliers = evidence_repository.list_suppliers(workspace_id)
    loaded = any(artifact.metadata.get("demo_asset") in DEMO_ASSET_KEYS for artifact in artifacts)
    return DemoDataResponse(
        loaded=loaded,
        has_artifacts=bool(artifacts),
        artifact_count=len(artifacts),
        shipment_count=len(shipments),
        supplier_count=len(suppliers),
        evidence_document_count=sum(supplier.document_count for supplier in suppliers),
    )


@demo_data_router.get(
    "",
    response_model=DemoDataResponse,
    response_model_exclude_none=True,
)
async def demo_data_status(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> DemoDataResponse:
    return _workspace_state(principal.workspace_id)


@demo_data_router.post("", response_model=DemoDataResponse)
async def load_demo_data(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
    response: Response,
) -> DemoDataResponse:
    """Load one bounded, fictional dataset into an otherwise empty workspace."""

    request_started_at = perf_counter()
    stages_ms: dict[str, int] = {}
    stage_started_at = perf_counter()
    existing = _workspace_state(principal.workspace_id)
    stages_ms["status"] = _elapsed_ms(stage_started_at)
    if existing.has_artifacts or existing.supplier_count:
        return _record_load_performance(
            response=response,
            workspace_id=principal.workspace_id,
            outcome="already_available",
            request_started_at=request_started_at,
            stages_ms=stages_ms,
            state=existing,
        )

    stage_started_at = perf_counter()
    parsed = parse_shipments_csv(
        DEMO_SHIPMENTS_CSV,
        content_type="text/csv",
        filename=DEMO_SHIPMENTS_FILENAME,
    )
    if not parsed.rows:
        raise RuntimeError("The checked-in demo shipment data is invalid.")
    stages_ms["parse"] = _elapsed_ms(stage_started_at)

    stage_started_at = perf_counter()
    shipment_artifact = create_artifact(
        workspace_id=principal.workspace_id,
        kind=ArtifactKind.SHIPMENT_DATASET,
        title=DEMO_SHIPMENTS_FILENAME,
        source_type=ArtifactSourceType.GENERATED,
        source_reference="CarbonSage fictional demo dataset",
        media_type="text/csv",
        content_sha256=sha256(DEMO_SHIPMENTS_CSV).hexdigest(),
        created_by=principal.subject,
        metadata={"demo_asset": "shipment-baseline"},
    )
    suppliers: list[SupplierMetadata] = []
    for demo_supplier in DEMO_SUPPLIERS:
        normalized = normalize_supplier_metadata(
            name=demo_supplier.name,
            region=demo_supplier.region,
            certifications=demo_supplier.certifications,
            transport_modes=demo_supplier.transport_modes,
        )
        suppliers.append(
            SupplierMetadata(
                name=normalized[0],
                region=normalized[1],
                certifications=normalized[2],
                transport_modes=normalized[3],
            )
        )

    prepared_evidence: list[PreparedEvidenceSeed] = []
    for source in DEMO_EVIDENCE_SOURCES:
        normalized = normalize_supplier_metadata(
            name=source.supplier_name,
            region=source.supplier_region,
            certifications=source.certifications,
            transport_modes=source.transport_modes,
        )
        extraction = extract_evidence(
            source.content,
            filename=source.filename,
            content_type="text/plain",
        )
        artifact = create_artifact(
            workspace_id=principal.workspace_id,
            kind=ArtifactKind.EVIDENCE_DOCUMENT,
            title=source.filename,
            source_type=ArtifactSourceType.GENERATED,
            source_reference="CarbonSage fictional demo dataset",
            media_type="text/plain",
            content_sha256=extraction.document.sha256,
            created_by=principal.subject,
            metadata={"demo_asset": source.key},
        )
        prepared_evidence.append(
            PreparedEvidenceSeed(
                artifact=artifact,
                supplier=SupplierMetadata(
                    name=normalized[0],
                    region=normalized[1],
                    certifications=normalized[2],
                    transport_modes=normalized[3],
                ),
                document=extraction.document,
                demo_asset=source.key,
            )
        )
    stages_ms["prepare"] = _elapsed_ms(stage_started_at)

    shipment_metadata = {
        "accepted_rows": len(parsed.rows),
        "validation_error_count": 0,
        "warning_count": len(parsed.warnings),
        "demo_asset": "shipment-baseline",
        "source_retention": generated_source_retention,
    }
    supplier_ids_by_name: dict[str, str] = {}
    stage_started_at = perf_counter()
    if demo_data_seeder is not None:
        seed_result = demo_data_seeder.seed(
            workspace_id=principal.workspace_id,
            shipment_artifact=shipment_artifact,
            shipments=parsed.rows,
            suppliers=tuple(suppliers),
            service_lanes=DEMO_SUPPLIER_SERVICE_LANES,
            evidence=tuple(prepared_evidence),
            shipment_metadata=shipment_metadata,
        )
        stages_ms["relational"] = _elapsed_ms(stage_started_at)
        if not seed_result.seeded:
            return _record_load_performance(
                response=response,
                workspace_id=principal.workspace_id,
                outcome="already_available",
                request_started_at=request_started_at,
                stages_ms=stages_ms,
                state=_workspace_state(principal.workspace_id),
            )
        supplier_ids_by_name = seed_result.supplier_ids_by_name
    else:
        artifact_repository.create(shipment_artifact)
        shipment_repository.replace_for_workspace(
            principal.workspace_id,
            shipment_artifact.artifact_id,
            parsed.rows,
        )
        for supplier in suppliers:
            stored_supplier = evidence_repository.upsert_supplier(
                principal.workspace_id,
                supplier,
            )
            supplier_ids_by_name[supplier.name] = stored_supplier.supplier_id
        supplier_availability_repository.upsert_many(
            principal.workspace_id,
            DEMO_SUPPLIER_SERVICE_LANES,
        )
        demo_supplier_ids = sorted(supplier_ids_by_name.values())
        artifact_repository.mark_ready(
            principal.workspace_id,
            shipment_artifact.artifact_id,
            {**shipment_metadata, "demo_supplier_ids": demo_supplier_ids},
        )
        for item in prepared_evidence:
            artifact_repository.create(item.artifact)
            stored_supplier = evidence_repository.store(
                principal.workspace_id,
                item.artifact.artifact_id,
                item.supplier,
                item.document,
            )
            supplier_ids_by_name[item.supplier.name] = stored_supplier.supplier_id
        stages_ms["relational"] = _elapsed_ms(stage_started_at)

    demo_supplier_metadata = sorted(supplier_ids_by_name.values())
    embedding_ms = 0
    relational_finalize_ms = 0
    for item in prepared_evidence:
        stage_started_at = perf_counter()
        embedding_status = await _index_document(
            principal.workspace_id,
            item.document,
        )
        embedding_ms += _elapsed_ms(stage_started_at)
        stage_started_at = perf_counter()
        artifact_repository.mark_ready(
            principal.workspace_id,
            item.artifact.artifact_id,
            {
                "supplier_id": supplier_ids_by_name[item.supplier.name],
                "supplier_name": item.supplier.name,
                "page_count": item.document.page_count,
                "chunk_count": len(item.document.chunks),
                "embedding_status": embedding_status,
                "demo_asset": item.demo_asset,
                "demo_supplier_ids": demo_supplier_metadata,
                "source_retention": generated_source_retention,
            },
        )
        relational_finalize_ms += _elapsed_ms(stage_started_at)

    stages_ms["relational"] += relational_finalize_ms
    stages_ms["embeddings"] = embedding_ms
    stage_started_at = perf_counter()
    state = _workspace_state(principal.workspace_id)
    assert all(
        artifact.status is ArtifactStatus.READY
        for artifact in artifact_repository.list_for_workspace(principal.workspace_id)
    )
    stages_ms["finalize"] = _elapsed_ms(stage_started_at)
    return _record_load_performance(
        response=response,
        workspace_id=principal.workspace_id,
        outcome="loaded",
        request_started_at=request_started_at,
        stages_ms=stages_ms,
        state=state,
    )


@demo_data_router.delete(
    "",
    response_model=DemoDataResponse,
    response_model_exclude_none=True,
)
async def unload_demo_data(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> DemoDataResponse:
    """Remove generated demo records while preserving user-provided workspace data."""

    artifacts = artifact_repository.list_for_workspace(principal.workspace_id)
    demo_artifacts = tuple(
        artifact for artifact in artifacts if artifact.metadata.get("demo_asset") in DEMO_ASSET_KEYS
    )
    if demo_artifacts:
        supplier_availability_repository.delete_for_suppliers(
            principal.workspace_id,
            tuple(supplier.name for supplier in DEMO_SUPPLIERS),
        )
    supplier_ids: set[str] = set()
    for artifact in demo_artifacts:
        artifact_supplier_ids = artifact.metadata.get("demo_supplier_ids")
        if isinstance(artifact_supplier_ids, list):
            supplier_ids.update(
                supplier_id for supplier_id in artifact_supplier_ids if isinstance(supplier_id, str)
            )

    for artifact in demo_artifacts:
        await schedule_artifact_source_delete(
            principal.workspace_id,
            artifact.artifact_id,
        )
        artifact_repository.soft_delete(
            principal.workspace_id,
            artifact.artifact_id,
        )
        if artifact.kind is ArtifactKind.SHIPMENT_DATASET:
            shipment_repository.delete_for_artifact(
                principal.workspace_id,
                artifact.artifact_id,
            )
        elif artifact.kind is ArtifactKind.EVIDENCE_DOCUMENT:
            evidence_repository.delete_for_artifact(
                principal.workspace_id,
                artifact.artifact_id,
            )

    # Demo artifacts created before supplier provenance was recorded can still be
    # cleaned up by matching the checked-in fictional names, but only after their
    # generated documents are gone and only when no user document remains.
    if demo_artifacts and not supplier_ids:
        demo_names = {supplier.name.casefold() for supplier in DEMO_SUPPLIERS}
        supplier_ids.update(
            supplier.supplier_id
            for supplier in evidence_repository.list_suppliers(principal.workspace_id)
            if supplier.name.casefold() in demo_names
        )

    evidence_repository.delete_suppliers_without_documents(
        principal.workspace_id,
        tuple(sorted(supplier_ids)),
    )
    return _workspace_state(principal.workspace_id)
