import os
import time
from contextlib import closing
from datetime import date

import pytest

from domain.artifacts.models import ArtifactKind, ArtifactSourceType, create_artifact
from domain.evidence.ingestion import extract_evidence
from domain.evidence.models import SupplierMetadata, SupplierServiceLane
from domain.shipments.models import NormalizedShipment
from domain.workspaces.sessions import WorkspaceSession
from persistence.artifacts import PostgresArtifactRepository
from persistence.database import pooled_connect
from persistence.demo_seed import PostgresDemoDataSeeder, PreparedEvidenceSeed
from persistence.evidence import PostgresEvidenceRepository
from persistence.shipments import PostgresShipmentRepository
from persistence.supplier_availability import PostgresSupplierAvailabilityRepository
from persistence.workspaces import build_workspace_repository

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="PostgreSQL integration test")


def _fail_before_commit(_cursor):
    raise RuntimeError("injected demo-seed failure")


def _delete_workspace(database_url: str, workspace_id: str) -> None:
    with closing(pooled_connect(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM workspaces WHERE workspace_id = %s", (workspace_id,))
        connection.commit()


def test_postgres_demo_seed_is_atomic_complete_and_idempotent():
    database_url = DATABASE_URL or ""
    workspace_repository = build_workspace_repository(database_url)
    workspace = WorkspaceSession.create(
        workspace_id=f"demo-seed-test-{time.time_ns()}",
        issued_at=int(time.time()),
        ttl_seconds=3_600,
    )
    workspace_repository.create(workspace)

    supplier = SupplierMetadata(
        name="Fixture Ocean Freight",
        region="Canada and China",
        certifications=("ISO 14001",),
        transport_modes=("ship",),
    )
    shipment = NormalizedShipment(
        shipment_id="FIXTURE-1",
        shipment_date=date(2026, 8, 24),
        supplier_name=supplier.name,
        origin="Vancouver, Canada",
        destination="Guangzhou, China",
        weight_kg=2_000,
        distance_km=11_300,
        transport_method="ship",
        source_row=2,
        freight_cost_value=2_800,
        freight_cost_currency="CAD",
    )
    lane = SupplierServiceLane(
        supplier_name=supplier.name,
        origin=shipment.origin,
        destination=shipment.destination,
        transport_method=shipment.transport_method,
        distance_km=shipment.distance_km,
        estimated_cost_per_kg=1.4,
        cost_currency="CAD",
        bidirectional=True,
        source_label="fixture service declaration",
        reference_shipment_id=shipment.shipment_id,
    )
    document = extract_evidence(
        b"Fixture Ocean Freight declares bidirectional Vancouver and Guangzhou service.",
        filename="fixture-service.txt",
        content_type="text/plain",
    ).document
    shipment_artifact = create_artifact(
        workspace_id=workspace.workspace_id,
        kind=ArtifactKind.SHIPMENT_DATASET,
        title="fixture-shipments.csv",
        source_type=ArtifactSourceType.GENERATED,
        created_by="test",
    )
    evidence_artifact = create_artifact(
        workspace_id=workspace.workspace_id,
        kind=ArtifactKind.EVIDENCE_DOCUMENT,
        title=document.filename,
        source_type=ArtifactSourceType.GENERATED,
        created_by="test",
        content_sha256=document.sha256,
    )
    prepared_evidence = PreparedEvidenceSeed(
        artifact=evidence_artifact,
        supplier=supplier,
        document=document,
        demo_asset="fixture-evidence",
    )
    seed_arguments = {
        "workspace_id": workspace.workspace_id,
        "shipment_artifact": shipment_artifact,
        "shipments": (shipment,),
        "suppliers": (supplier,),
        "service_lanes": (lane,),
        "evidence": (prepared_evidence,),
        "shipment_metadata": {"demo_asset": "fixture-shipments"},
    }

    artifacts = PostgresArtifactRepository(database_url)
    shipments = PostgresShipmentRepository(database_url)
    evidence = PostgresEvidenceRepository(database_url)
    availability = PostgresSupplierAvailabilityRepository(database_url)

    try:
        with pytest.raises(RuntimeError, match="injected demo-seed failure"):
            PostgresDemoDataSeeder(
                database_url,
                before_commit=_fail_before_commit,
            ).seed(**seed_arguments)

        assert artifacts.list_for_workspace(workspace.workspace_id) == ()
        assert shipments.list_for_workspace(workspace.workspace_id) == ()
        assert evidence.list_suppliers(workspace.workspace_id) == ()
        assert availability.list_for_workspace(workspace.workspace_id) == ()

        seeded = PostgresDemoDataSeeder(database_url).seed(**seed_arguments)

        assert seeded.seeded is True
        assert seeded.supplier_ids_by_name.keys() == {supplier.name}
        assert len(artifacts.list_for_workspace(workspace.workspace_id)) == 2
        assert len(shipments.list_for_workspace(workspace.workspace_id)) == 1
        supplier_cards = evidence.list_suppliers(workspace.workspace_id)
        assert len(supplier_cards) == 1
        assert supplier_cards[0].document_count == 1
        assert availability.list_for_workspace(workspace.workspace_id) == (lane,)

        repeated = PostgresDemoDataSeeder(database_url).seed(**seed_arguments)
        assert repeated.seeded is False
        assert len(artifacts.list_for_workspace(workspace.workspace_id)) == 2
    finally:
        _delete_workspace(database_url, workspace.workspace_id)
