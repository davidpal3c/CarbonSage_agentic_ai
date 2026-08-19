"""Idempotent first-run data for the public CarbonSage workspace."""

from __future__ import annotations

from hashlib import sha256
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.artifacts import artifact_repository, schedule_artifact_source_delete
from api.evidence import _index_document, evidence_repository
from api.shipments import shipment_repository
from api.workspaces import require_workspace_principal
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
    DEMO_SUPPLIERS,
)
from domain.evidence.ingestion import extract_evidence, normalize_supplier_metadata
from domain.evidence.models import SupplierMetadata
from domain.shipments.ingestion import parse_shipments_csv
from domain.workspaces.principals import WorkspacePrincipal

demo_data_router = APIRouter(prefix="/demo/data", tags=["workspace"])
generated_source_retention = SourceRetention(status="ephemeral").to_dict()
DEMO_ASSET_KEYS = {
    "shipment-baseline",
    *(source.key for source in DEMO_EVIDENCE_SOURCES),
}


class DemoDataResponse(BaseModel):
    loaded: bool
    has_artifacts: bool
    artifact_count: int
    shipment_count: int
    supplier_count: int
    evidence_document_count: int


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


@demo_data_router.get("", response_model=DemoDataResponse)
async def demo_data_status(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> DemoDataResponse:
    return _workspace_state(principal.workspace_id)


@demo_data_router.post("", response_model=DemoDataResponse)
async def load_demo_data(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> DemoDataResponse:
    """Load one bounded, fictional dataset into an otherwise empty workspace."""

    existing = _workspace_state(principal.workspace_id)
    if existing.has_artifacts or existing.supplier_count:
        return existing

    parsed = parse_shipments_csv(
        DEMO_SHIPMENTS_CSV,
        content_type="text/csv",
        filename=DEMO_SHIPMENTS_FILENAME,
    )
    if not parsed.rows:
        raise RuntimeError("The checked-in demo shipment data is invalid.")

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
    artifact_repository.create(shipment_artifact)
    shipment_repository.replace_for_workspace(
        principal.workspace_id,
        shipment_artifact.artifact_id,
        parsed.rows,
    )
    existing_supplier_ids = {
        supplier.supplier_id
        for supplier in evidence_repository.list_suppliers(principal.workspace_id)
    }
    demo_supplier_ids: list[str] = []
    for demo_supplier in DEMO_SUPPLIERS:
        normalized = normalize_supplier_metadata(
            name=demo_supplier.name,
            region=demo_supplier.region,
            certifications=demo_supplier.certifications,
            transport_modes=demo_supplier.transport_modes,
        )
        stored_supplier = evidence_repository.upsert_supplier(
            principal.workspace_id,
            SupplierMetadata(
                name=normalized[0],
                region=normalized[1],
                certifications=normalized[2],
                transport_modes=normalized[3],
            ),
        )
        if stored_supplier.supplier_id not in existing_supplier_ids:
            demo_supplier_ids.append(stored_supplier.supplier_id)

    demo_supplier_metadata = sorted(set(demo_supplier_ids))
    artifact_repository.mark_ready(
        principal.workspace_id,
        shipment_artifact.artifact_id,
        {
            "accepted_rows": len(parsed.rows),
            "validation_error_count": 0,
            "warning_count": len(parsed.warnings),
            "demo_asset": "shipment-baseline",
            "demo_supplier_ids": demo_supplier_metadata,
            "source_retention": generated_source_retention,
        },
    )

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
        artifact_repository.create(artifact)
        supplier = SupplierMetadata(
            name=normalized[0],
            region=normalized[1],
            certifications=normalized[2],
            transport_modes=normalized[3],
        )
        stored_supplier = evidence_repository.store(
            principal.workspace_id,
            artifact.artifact_id,
            supplier,
            extraction.document,
        )
        embedding_status = await _index_document(
            principal.workspace_id,
            extraction.document,
        )
        artifact_repository.mark_ready(
            principal.workspace_id,
            artifact.artifact_id,
            {
                "supplier_id": stored_supplier.supplier_id,
                "supplier_name": stored_supplier.name,
                "page_count": extraction.document.page_count,
                "chunk_count": len(extraction.document.chunks),
                "embedding_status": embedding_status,
                "demo_asset": source.key,
                "demo_supplier_ids": demo_supplier_metadata,
                "source_retention": generated_source_retention,
            },
        )

    state = _workspace_state(principal.workspace_id)
    assert all(
        artifact.status is ArtifactStatus.READY
        for artifact in artifact_repository.list_for_workspace(principal.workspace_id)
    )
    return state


@demo_data_router.delete("", response_model=DemoDataResponse)
async def unload_demo_data(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> DemoDataResponse:
    """Remove generated demo records while preserving user-provided workspace data."""

    artifacts = artifact_repository.list_for_workspace(principal.workspace_id)
    demo_artifacts = tuple(
        artifact for artifact in artifacts if artifact.metadata.get("demo_asset") in DEMO_ASSET_KEYS
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
