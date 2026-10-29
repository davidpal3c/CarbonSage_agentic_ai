"""Workspace-scoped supplier service availability persistence."""

from __future__ import annotations

from contextlib import closing
from typing import Protocol
from uuid import uuid4

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

from domain.evidence.models import SupplierServiceLane
from persistence.database import pooled_connect


class SupplierAvailabilityRepository(Protocol):
    def upsert_many(
        self,
        workspace_id: str,
        lanes: tuple[SupplierServiceLane, ...],
    ) -> int: ...

    def list_for_workspace(self, workspace_id: str) -> tuple[SupplierServiceLane, ...]: ...

    def delete_for_suppliers(
        self,
        workspace_id: str,
        supplier_names: tuple[str, ...],
    ) -> int: ...


class InMemorySupplierAvailabilityRepository:
    def __init__(self) -> None:
        self._lanes: dict[str, tuple[SupplierServiceLane, ...]] = {}

    def upsert_many(
        self,
        workspace_id: str,
        lanes: tuple[SupplierServiceLane, ...],
    ) -> int:
        existing = {
            (
                lane.supplier_name.casefold(),
                lane.origin.casefold(),
                lane.destination.casefold(),
                lane.transport_method.casefold(),
            ): lane
            for lane in self._lanes.get(workspace_id, ())
        }
        for lane in lanes:
            existing[
                (
                    lane.supplier_name.casefold(),
                    lane.origin.casefold(),
                    lane.destination.casefold(),
                    lane.transport_method.casefold(),
                )
            ] = lane
        self._lanes[workspace_id] = tuple(existing.values())
        return len(lanes)

    def list_for_workspace(self, workspace_id: str) -> tuple[SupplierServiceLane, ...]:
        return tuple(self._lanes.get(workspace_id, ()))

    def delete_for_suppliers(
        self,
        workspace_id: str,
        supplier_names: tuple[str, ...],
    ) -> int:
        requested = {name.casefold() for name in supplier_names}
        current = self._lanes.get(workspace_id, ())
        remaining = tuple(
            lane for lane in current if lane.supplier_name.casefold() not in requested
        )
        self._lanes[workspace_id] = remaining
        return len(current) - len(remaining)


class PostgresSupplierAvailabilityRepository:
    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return pooled_connect(self.database_url)

    def upsert_many(
        self,
        workspace_id: str,
        lanes: tuple[SupplierServiceLane, ...],
    ) -> int:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO supplier_service_lanes
                        (lane_id, workspace_id, supplier_id, origin, destination,
                         transport_method, distance_km, estimated_cost_per_kg,
                         cost_currency, bidirectional, source_label,
                         reference_shipment_id)
                    SELECT %s, %s, supplier_id, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    FROM suppliers
                    WHERE workspace_id = %s AND name = %s
                    ON CONFLICT
                        (workspace_id, supplier_id, origin, destination, transport_method)
                    DO UPDATE SET distance_km = EXCLUDED.distance_km,
                                  estimated_cost_per_kg = EXCLUDED.estimated_cost_per_kg,
                                  cost_currency = EXCLUDED.cost_currency,
                                  bidirectional = EXCLUDED.bidirectional,
                                  source_label = EXCLUDED.source_label,
                                  reference_shipment_id = EXCLUDED.reference_shipment_id,
                                  updated_at = CURRENT_TIMESTAMP
                    """,
                    [
                        (
                            str(uuid4()),
                            workspace_id,
                            lane.origin,
                            lane.destination,
                            lane.transport_method,
                            lane.distance_km,
                            lane.estimated_cost_per_kg,
                            lane.cost_currency,
                            lane.bidirectional,
                            lane.source_label,
                            lane.reference_shipment_id,
                            workspace_id,
                            lane.supplier_name,
                        )
                        for lane in lanes
                    ],
                )
            connection.commit()
        return len(lanes)

    def list_for_workspace(self, workspace_id: str) -> tuple[SupplierServiceLane, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT supplier.name, lane.origin, lane.destination,
                           lane.transport_method, lane.distance_km,
                           lane.estimated_cost_per_kg, lane.cost_currency,
                           lane.bidirectional, lane.source_label,
                           lane.reference_shipment_id
                    FROM supplier_service_lanes AS lane
                    JOIN suppliers AS supplier
                      ON supplier.supplier_id = lane.supplier_id
                     AND supplier.workspace_id = lane.workspace_id
                    WHERE lane.workspace_id = %s
                    ORDER BY supplier.name, lane.origin, lane.destination,
                             lane.transport_method
                    """,
                    (workspace_id,),
                )
                rows = cursor.fetchall()
        return tuple(SupplierServiceLane(*row) for row in rows)

    def delete_for_suppliers(
        self,
        workspace_id: str,
        supplier_names: tuple[str, ...],
    ) -> int:
        if not supplier_names:
            return 0
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM supplier_service_lanes AS lane
                    USING suppliers AS supplier
                    WHERE lane.workspace_id = %s
                      AND supplier.workspace_id = lane.workspace_id
                      AND supplier.supplier_id = lane.supplier_id
                      AND supplier.name = ANY(%s)
                    """,
                    (workspace_id, list(supplier_names)),
                )
                deleted = cursor.rowcount
            connection.commit()
        return deleted


def build_supplier_availability_repository(
    database_url: str | None,
) -> SupplierAvailabilityRepository:
    if database_url:
        return PostgresSupplierAvailabilityRepository(database_url)
    return InMemorySupplierAvailabilityRepository()
