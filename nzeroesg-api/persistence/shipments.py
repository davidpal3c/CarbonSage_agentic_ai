"""Workspace-scoped shipment record persistence."""

from __future__ import annotations

from contextlib import closing
from typing import Protocol
from uuid import uuid4

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised only before optional local setup
    psycopg = None

from domain.shipments.models import NormalizedShipment


class ShipmentRepository(Protocol):
    def replace_for_workspace(
        self,
        workspace_id: str,
        artifact_id: str,
        shipments: tuple[NormalizedShipment, ...],
    ) -> None: ...

    def list_for_workspace(self, workspace_id: str) -> tuple[NormalizedShipment, ...]: ...

    def delete_for_artifact(self, workspace_id: str, artifact_id: str) -> int: ...


def _clone(shipment: NormalizedShipment) -> NormalizedShipment:
    return NormalizedShipment(
        shipment_id=shipment.shipment_id,
        shipment_date=shipment.shipment_date,
        supplier_name=shipment.supplier_name,
        origin=shipment.origin,
        destination=shipment.destination,
        weight_kg=shipment.weight_kg,
        distance_km=shipment.distance_km,
        transport_method=shipment.transport_method,
        source_row=shipment.source_row,
        freight_cost_value=shipment.freight_cost_value,
        freight_cost_currency=shipment.freight_cost_currency,
    )


class InMemoryShipmentRepository:
    """Non-persistent local fallback keyed by workspace id."""

    def __init__(self) -> None:
        self._shipments: dict[str, tuple[str, tuple[NormalizedShipment, ...]]] = {}

    def replace_for_workspace(
        self,
        workspace_id: str,
        artifact_id: str,
        shipments: tuple[NormalizedShipment, ...],
    ) -> None:
        self._shipments[workspace_id] = (
            artifact_id,
            tuple(_clone(shipment) for shipment in shipments),
        )

    def list_for_workspace(self, workspace_id: str) -> tuple[NormalizedShipment, ...]:
        record = self._shipments.get(workspace_id)
        if record is None:
            return ()
        return tuple(_clone(shipment) for shipment in record[1])

    def delete_for_artifact(self, workspace_id: str, artifact_id: str) -> int:
        record = self._shipments.get(workspace_id)
        if record is None or record[0] != artifact_id:
            return 0
        deleted = len(record[1])
        del self._shipments[workspace_id]
        return deleted


class PostgresShipmentRepository:
    """PostgreSQL adapter for normalized shipment rows."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    def replace_for_workspace(
        self,
        workspace_id: str,
        artifact_id: str,
        shipments: tuple[NormalizedShipment, ...],
    ) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM shipments WHERE workspace_id = %s", (workspace_id,))
                cursor.executemany(
                    """
                    INSERT INTO shipments
                        (record_id, workspace_id, artifact_id, shipment_id, shipment_date,
                         supplier_name,
                         origin, destination, weight_kg, distance_km, transport_method, source_row,
                         freight_cost_value, freight_cost_currency)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            str(uuid4()),
                            workspace_id,
                            artifact_id,
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
            connection.commit()

    def list_for_workspace(self, workspace_id: str) -> tuple[NormalizedShipment, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT shipment_id, shipment_date, supplier_name, origin, destination,
                           weight_kg, distance_km, transport_method, source_row,
                           freight_cost_value, freight_cost_currency
                    FROM shipments AS shipment
                    JOIN artifacts AS artifact
                      ON artifact.artifact_id = shipment.artifact_id
                     AND artifact.workspace_id = shipment.workspace_id
                     AND artifact.deleted_at IS NULL
                    WHERE shipment.workspace_id = %s
                    ORDER BY source_row, record_id
                    """,
                    (workspace_id,),
                )
                rows = cursor.fetchall()
        return tuple(
            NormalizedShipment(
                shipment_id=row[0],
                shipment_date=row[1],
                supplier_name=row[2],
                origin=row[3],
                destination=row[4],
                weight_kg=row[5],
                distance_km=row[6],
                transport_method=row[7],
                source_row=row[8],
                freight_cost_value=row[9],
                freight_cost_currency=row[10],
            )
            for row in rows
        )

    def delete_for_artifact(self, workspace_id: str, artifact_id: str) -> int:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM shipments
                    WHERE workspace_id = %s AND artifact_id = %s
                    """,
                    (workspace_id, artifact_id),
                )
                deleted = cursor.rowcount
            connection.commit()
        return deleted


def build_shipment_repository(database_url: str | None) -> ShipmentRepository:
    if database_url:
        return PostgresShipmentRepository(database_url)
    return InMemoryShipmentRepository()
