"""Framework-independent shipment records and validation issues."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class ValidationIssue:
    row_number: int | None
    field: str | None
    message: str

    def to_dict(self) -> dict[str, int | str | None]:
        return {
            "row_number": self.row_number,
            "field": self.field,
            "message": self.message,
        }


@dataclass(frozen=True)
class NormalizedShipment:
    shipment_id: str
    origin: str
    destination: str
    weight_kg: float
    distance_km: float
    transport_method: str
    source_row: int
    shipment_date: date | None = None
    supplier_name: str | None = None
    freight_cost_value: float | None = None
    freight_cost_currency: str | None = None

    def to_dict(self) -> dict[str, int | float | str | None]:
        return {
            "shipment_id": self.shipment_id,
            "shipment_date": (
                self.shipment_date.isoformat() if self.shipment_date is not None else None
            ),
            "supplier_name": self.supplier_name,
            "origin": self.origin,
            "destination": self.destination,
            "weight_kg": self.weight_kg,
            "distance_km": self.distance_km,
            "transport_method": self.transport_method,
            "freight_cost_value": self.freight_cost_value,
            "freight_cost_currency": self.freight_cost_currency,
            "source_row": self.source_row,
        }
