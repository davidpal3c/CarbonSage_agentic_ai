"""Transactional PostgreSQL seed for the bounded fictional workspace."""

from __future__ import annotations

from collections.abc import Callable
from contextlib import closing
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

try:
    from psycopg.types.json import Jsonb
except ImportError:  # pragma: no cover - exercised only before dependency setup
    Jsonb = None

from domain.artifacts.models import Artifact, ArtifactStatus
from domain.evidence.models import EvidenceDocument, SupplierMetadata, SupplierServiceLane
from domain.shipments.models import NormalizedShipment
from persistence.database import pooled_connect


@dataclass(frozen=True)
class PreparedEvidenceSeed:
    artifact: Artifact
    supplier: SupplierMetadata
    document: EvidenceDocument
    demo_asset: str


@dataclass(frozen=True)
class DemoRelationalSeedResult:
    seeded: bool
    supplier_ids_by_name: dict[str, str]


class PostgresDemoDataSeeder:
    """Write the relational demo graph atomically on one pooled connection."""

    def __init__(
        self,
        database_url: str,
        *,
        before_commit: Callable[[Any], None] | None = None,
    ) -> None:
        if Jsonb is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url
        self.before_commit = before_commit

    def seed(
        self,
        *,
        workspace_id: str,
        shipment_artifact: Artifact,
        shipments: tuple[NormalizedShipment, ...],
        suppliers: tuple[SupplierMetadata, ...],
        service_lanes: tuple[SupplierServiceLane, ...],
        evidence: tuple[PreparedEvidenceSeed, ...],
        shipment_metadata: dict[str, object],
    ) -> DemoRelationalSeedResult:
        supplier_names = [supplier.name for supplier in suppliers]
        if len(supplier_names) != len(set(supplier_names)):
            raise ValueError("Demo supplier names must be unique.")
        known_suppliers = set(supplier_names)
        if any(item.supplier.name not in known_suppliers for item in evidence):
            raise ValueError("Every evidence document must reference a demo supplier.")
        if any(lane.supplier_name not in known_suppliers for lane in service_lanes):
            raise ValueError("Every service lane must reference a demo supplier.")

        supplier_ids = {name: str(uuid4()) for name in supplier_names}
        with closing(pooled_connect(self.database_url)) as connection:
            with connection.transaction():
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT pg_advisory_xact_lock(hashtext(%s))",
                        (f"carbonsage-demo-seed:{workspace_id}",),
                    )
                    cursor.execute(
                        """
                        SELECT EXISTS (
                            SELECT 1 FROM artifacts
                            WHERE workspace_id = %s AND deleted_at IS NULL
                        ) OR EXISTS (
                            SELECT 1 FROM suppliers WHERE workspace_id = %s
                        )
                        """,
                        (workspace_id, workspace_id),
                    )
                    if cursor.fetchone()[0]:
                        return DemoRelationalSeedResult(False, {})

                    cursor.executemany(
                        """
                        INSERT INTO suppliers
                            (supplier_id, workspace_id, name, region,
                             certifications, transport_modes)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                supplier_ids[supplier.name],
                                workspace_id,
                                supplier.name,
                                supplier.region,
                                list(supplier.certifications),
                                list(supplier.transport_modes),
                            )
                            for supplier in suppliers
                        ],
                    )

                    artifact_rows = [
                        self._artifact_row(
                            shipment_artifact,
                            status=ArtifactStatus.READY,
                            metadata={
                                **shipment_metadata,
                                "demo_supplier_ids": sorted(supplier_ids.values()),
                            },
                        ),
                        *[
                            self._artifact_row(
                                item.artifact,
                                status=ArtifactStatus.PROCESSING,
                                metadata={"demo_asset": item.demo_asset},
                            )
                            for item in evidence
                        ],
                    ]
                    cursor.executemany(
                        """
                        INSERT INTO artifacts
                            (artifact_id, workspace_id, kind, title, status,
                             source_type, source_reference, media_type,
                             content_sha256, version, metadata, created_by,
                             created_at, updated_at, deleted_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, %s)
                        """,
                        artifact_rows,
                    )

                    cursor.executemany(
                        """
                        INSERT INTO shipments
                            (record_id, workspace_id, artifact_id, shipment_id,
                             shipment_date, supplier_name, origin, destination,
                             weight_kg, distance_km, transport_method, source_row,
                             freight_cost_value, freight_cost_currency)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s, %s)
                        """,
                        [
                            (
                                str(uuid4()),
                                workspace_id,
                                shipment_artifact.artifact_id,
                                shipment.shipment_id,
                                shipment.shipment_date,
                                shipment.supplier_name,
                                shipment.origin,
                                shipment.destination,
                                shipment.weight_kg,
                                shipment.distance_km,
                                shipment.transport_method,
                                shipment.source_row,
                                shipment.freight_cost_value,
                                shipment.freight_cost_currency,
                            )
                            for shipment in shipments
                        ],
                    )

                    cursor.executemany(
                        """
                        INSERT INTO supplier_service_lanes
                            (lane_id, workspace_id, supplier_id, origin,
                             destination, transport_method, distance_km,
                             estimated_cost_per_kg, cost_currency,
                             bidirectional, source_label, reference_shipment_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s)
                        """,
                        [
                            (
                                str(uuid4()),
                                workspace_id,
                                supplier_ids[lane.supplier_name],
                                lane.origin,
                                lane.destination,
                                lane.transport_method,
                                lane.distance_km,
                                lane.estimated_cost_per_kg,
                                lane.cost_currency,
                                lane.bidirectional,
                                lane.source_label,
                                lane.reference_shipment_id,
                            )
                            for lane in service_lanes
                        ],
                    )

                    for item in evidence:
                        document_id = str(uuid4())
                        supplier_id = supplier_ids[item.supplier.name]
                        cursor.execute(
                            """
                            INSERT INTO evidence_documents
                                (document_id, workspace_id, artifact_id,
                                 supplier_id, filename, media_type, sha256,
                                 page_count, extracted_chars)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                document_id,
                                workspace_id,
                                item.artifact.artifact_id,
                                supplier_id,
                                item.document.filename,
                                item.document.media_type,
                                item.document.sha256,
                                item.document.page_count,
                                item.document.extracted_chars,
                            ),
                        )
                        cursor.executemany(
                            """
                            INSERT INTO evidence_chunks
                                (chunk_id, workspace_id, document_id,
                                 supplier_id, chunk_index, page_number,
                                 section, content)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            [
                                (
                                    str(uuid4()),
                                    workspace_id,
                                    document_id,
                                    supplier_id,
                                    chunk.chunk_index,
                                    chunk.page_number,
                                    chunk.section,
                                    chunk.content,
                                )
                                for chunk in item.document.chunks
                            ],
                        )

                    if self.before_commit is not None:
                        self.before_commit(cursor)

        return DemoRelationalSeedResult(
            True,
            dict(supplier_ids),
        )

    @staticmethod
    def _artifact_row(
        artifact: Artifact,
        *,
        status: ArtifactStatus,
        metadata: dict[str, object],
    ) -> tuple[object, ...]:
        return (
            artifact.artifact_id,
            artifact.workspace_id,
            artifact.kind.value,
            artifact.title,
            status.value,
            artifact.source_type.value,
            artifact.source_reference,
            artifact.media_type,
            artifact.content_sha256,
            artifact.version,
            Jsonb(metadata),
            artifact.created_by,
            artifact.created_at,
            artifact.updated_at,
            artifact.deleted_at,
        )


def build_demo_data_seeder(database_url: str | None) -> PostgresDemoDataSeeder | None:
    return PostgresDemoDataSeeder(database_url) if database_url else None
