"""Deterministic shipment totals, trends, mode breakdowns, and hotspots."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from domain.emissions.calculator import calculate_emissions
from domain.emissions.factors import factor_for
from domain.shipments.models import NormalizedShipment

AnalyticsGranularity = Literal["month", "year"]


@dataclass(frozen=True)
class SupplierContribution:
    supplier_name: str | None
    shipment_count: int
    emissions_kg: float

    def to_dict(self) -> dict[str, str | int | float | None]:
        return {
            "supplier_name": self.supplier_name,
            "shipment_count": self.shipment_count,
            "emissions_kg": round(self.emissions_kg, 6),
        }


@dataclass(frozen=True)
class ModeBreakdown:
    shipment_count: int
    weight_kg: float
    emissions_kg: float
    suppliers: tuple[SupplierContribution, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "shipment_count": self.shipment_count,
            "weight_kg": round(self.weight_kg, 6),
            "emissions_kg": round(self.emissions_kg, 6),
            "suppliers": [supplier.to_dict() for supplier in self.suppliers],
        }


@dataclass(frozen=True)
class ShipmentHotspot:
    shipment_id: str
    shipment_date: date | None
    supplier_name: str | None
    origin: str
    destination: str
    transport_method: str
    emissions_kg: float

    def to_dict(self) -> dict[str, str | float | None]:
        return {
            "shipment_id": self.shipment_id,
            "shipment_date": (
                self.shipment_date.isoformat() if self.shipment_date is not None else None
            ),
            "supplier_name": self.supplier_name,
            "origin": self.origin,
            "destination": self.destination,
            "transport_method": self.transport_method,
            "emissions_kg": round(self.emissions_kg, 6),
        }


@dataclass(frozen=True)
class ShipmentPeriod:
    period: str
    period_start: date | None
    shipment_count: int
    weight_kg: float
    emissions_kg: float
    mode_emissions_kg: dict[str, float]

    def to_dict(self) -> dict[str, object]:
        return {
            "period": self.period,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "shipment_count": self.shipment_count,
            "weight_kg": round(self.weight_kg, 6),
            "emissions_kg": round(self.emissions_kg, 6),
            "mode_emissions_kg": {
                mode: round(value, 6) for mode, value in self.mode_emissions_kg.items()
            },
        }


@dataclass(frozen=True)
class ShipmentAnalysis:
    shipment_count: int
    workspace_shipment_count: int
    filtered_out_count: int
    undated_shipment_count: int
    total_weight_kg: float
    total_emissions_kg: float
    mode_breakdown: dict[str, ModeBreakdown]
    timeline: tuple[ShipmentPeriod, ...]
    hotspots: tuple[ShipmentHotspot, ...]
    granularity: AnalyticsGranularity
    start_date: date | None
    end_date: date | None
    selected_modes: tuple[str, ...]
    available_start_date: date | None
    available_end_date: date | None
    available_modes: tuple[str, ...]
    warnings: tuple[str, ...]
    factor_source: str
    factor_version: str
    factor_applicability: str
    assumptions: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "shipment_count": self.shipment_count,
            "workspace_shipment_count": self.workspace_shipment_count,
            "filtered_out_count": self.filtered_out_count,
            "undated_shipment_count": self.undated_shipment_count,
            "total_weight_kg": round(self.total_weight_kg, 6),
            "total_emissions_kg": round(self.total_emissions_kg, 6),
            "total_emissions_tonnes": round(self.total_emissions_kg / 1_000, 6),
            "mode_breakdown": {
                mode: breakdown.to_dict() for mode, breakdown in self.mode_breakdown.items()
            },
            "timeline": [period.to_dict() for period in self.timeline],
            "hotspots": [hotspot.to_dict() for hotspot in self.hotspots],
            "filters": {
                "granularity": self.granularity,
                "start_date": self.start_date.isoformat() if self.start_date else None,
                "end_date": self.end_date.isoformat() if self.end_date else None,
                "modes": list(self.selected_modes),
            },
            "available_filters": {
                "start_date": (
                    self.available_start_date.isoformat() if self.available_start_date else None
                ),
                "end_date": (
                    self.available_end_date.isoformat() if self.available_end_date else None
                ),
                "modes": list(self.available_modes),
            },
            "warnings": list(self.warnings),
            "factor_source": self.factor_source,
            "factor_version": self.factor_version,
            "factor_applicability": self.factor_applicability,
            "assumptions": list(self.assumptions),
        }


def _period_identity(
    shipment_date: date | None,
    granularity: AnalyticsGranularity,
) -> tuple[date | None, str]:
    if shipment_date is None:
        return None, "Undated"
    if granularity == "year":
        return date(shipment_date.year, 1, 1), str(shipment_date.year)
    return date(shipment_date.year, shipment_date.month, 1), shipment_date.strftime("%Y-%m")


def analyze_shipments(
    shipments: tuple[NormalizedShipment, ...] | list[NormalizedShipment],
    *,
    parser_warnings: tuple[str, ...] = (),
    start_date: date | None = None,
    end_date: date | None = None,
    modes: tuple[str, ...] = (),
    granularity: AnalyticsGranularity = "month",
) -> ShipmentAnalysis:
    if start_date and end_date and start_date > end_date:
        raise ValueError("The analytics start date must not follow the end date.")
    if granularity not in ("month", "year"):
        raise ValueError("Analytics granularity must be month or year.")

    all_shipments = tuple(shipments)
    available_dates = tuple(
        shipment.shipment_date for shipment in all_shipments if shipment.shipment_date is not None
    )
    available_modes = tuple(sorted({shipment.transport_method for shipment in all_shipments}))
    selected_mode_set = set(modes)
    selected_shipments = tuple(
        shipment
        for shipment in all_shipments
        if (not selected_mode_set or shipment.transport_method in selected_mode_set)
        and (
            start_date is None
            or (shipment.shipment_date is not None and shipment.shipment_date >= start_date)
        )
        and (
            end_date is None
            or (shipment.shipment_date is not None and shipment.shipment_date <= end_date)
        )
    )

    mode_totals: dict[str, list[float]] = {}
    mode_supplier_totals: dict[str, dict[str | None, list[float]]] = {}
    period_totals: dict[tuple[date | None, str], dict[str, object]] = {}
    hotspots: list[ShipmentHotspot] = []
    total_weight = 0.0
    total_emissions = 0.0
    factor_sources: list[str] = []
    factor_versions: list[str] = []
    assumptions: list[str] = []
    warnings = list(parser_warnings)

    for shipment in selected_shipments:
        result = calculate_emissions(
            weight_value=shipment.weight_kg,
            weight_unit="kg",
            distance_value=shipment.distance_km,
            distance_unit="km",
            mode=shipment.transport_method,
            distance_method="route",
            origin=shipment.origin,
            destination=shipment.destination,
        )
        total_weight += shipment.weight_kg
        total_emissions += result.emissions_kg
        mode_values = mode_totals.setdefault(shipment.transport_method, [0.0, 0.0, 0.0])
        mode_values[0] += 1
        mode_values[1] += shipment.weight_kg
        mode_values[2] += result.emissions_kg
        supplier_values = mode_supplier_totals.setdefault(shipment.transport_method, {}).setdefault(
            shipment.supplier_name, [0.0, 0.0]
        )
        supplier_values[0] += 1
        supplier_values[1] += result.emissions_kg

        period_key = _period_identity(shipment.shipment_date, granularity)
        period_values = period_totals.setdefault(
            period_key,
            {
                "shipment_count": 0,
                "weight_kg": 0.0,
                "emissions_kg": 0.0,
                "mode_emissions_kg": {},
            },
        )
        period_values["shipment_count"] = int(period_values["shipment_count"]) + 1
        period_values["weight_kg"] = float(period_values["weight_kg"]) + shipment.weight_kg
        period_values["emissions_kg"] = float(period_values["emissions_kg"]) + result.emissions_kg
        period_modes = period_values["mode_emissions_kg"]
        assert isinstance(period_modes, dict)
        period_modes[shipment.transport_method] = (
            float(period_modes.get(shipment.transport_method, 0.0)) + result.emissions_kg
        )

        hotspots.append(
            ShipmentHotspot(
                shipment_id=shipment.shipment_id,
                shipment_date=shipment.shipment_date,
                supplier_name=shipment.supplier_name,
                origin=shipment.origin,
                destination=shipment.destination,
                transport_method=shipment.transport_method,
                emissions_kg=result.emissions_kg,
            )
        )
        factor = factor_for(shipment.transport_method)
        factor_sources.append(factor.source)
        factor_versions.append(factor.version)
        assumptions.extend(factor.assumptions)
        warnings.extend(result.warnings)

    unique_sources = tuple(dict.fromkeys(factor_sources))
    unique_versions = tuple(dict.fromkeys(factor_versions))
    unique_assumptions = tuple(dict.fromkeys(assumptions))
    undated_count = sum(shipment.shipment_date is None for shipment in selected_shipments)
    if undated_count:
        warnings.append(
            f"{undated_count} shipment{'s' if undated_count != 1 else ''} have no shipment "
            "date and are grouped as Undated."
        )
    if len(unique_sources) > 1 or len(unique_versions) > 1:
        warnings.append("Multiple factor records are present in this analysis.")

    timeline_modes = tuple(sorted(mode_totals))
    timeline = tuple(
        ShipmentPeriod(
            period=period_key[1],
            period_start=period_key[0],
            shipment_count=int(values["shipment_count"]),
            weight_kg=float(values["weight_kg"]),
            emissions_kg=float(values["emissions_kg"]),
            mode_emissions_kg={
                mode: float(values["mode_emissions_kg"].get(mode, 0.0)) for mode in timeline_modes
            },
        )
        for period_key, values in sorted(
            period_totals.items(),
            key=lambda item: (item[0][0] is None, item[0][0] or date.max),
        )
    )

    return ShipmentAnalysis(
        shipment_count=len(selected_shipments),
        workspace_shipment_count=len(all_shipments),
        filtered_out_count=len(all_shipments) - len(selected_shipments),
        undated_shipment_count=undated_count,
        total_weight_kg=round(total_weight, 6),
        total_emissions_kg=round(total_emissions, 6),
        mode_breakdown={
            mode: ModeBreakdown(
                shipment_count=int(values[0]),
                weight_kg=values[1],
                emissions_kg=values[2],
                suppliers=tuple(
                    SupplierContribution(
                        supplier_name=supplier_name,
                        shipment_count=int(supplier_values[0]),
                        emissions_kg=supplier_values[1],
                    )
                    for supplier_name, supplier_values in sorted(
                        mode_supplier_totals[mode].items(),
                        key=lambda item: (
                            -item[1][1],
                            item[0] is None,
                            item[0] or "",
                        ),
                    )
                ),
            )
            for mode, values in sorted(mode_totals.items())
        },
        timeline=timeline,
        hotspots=tuple(
            sorted(
                hotspots,
                key=lambda hotspot: (-hotspot.emissions_kg, hotspot.shipment_id),
            )[:10]
        ),
        granularity=granularity,
        start_date=start_date,
        end_date=end_date,
        selected_modes=tuple(sorted(selected_mode_set)),
        available_start_date=min(available_dates) if available_dates else None,
        available_end_date=max(available_dates) if available_dates else None,
        available_modes=available_modes,
        warnings=tuple(dict.fromkeys(warnings)),
        factor_source=(
            unique_sources[0] if len(unique_sources) == 1 else "Multiple factor records"
        ),
        factor_version=(
            unique_versions[0] if len(unique_versions) == 1 else "Multiple factor versions"
        ),
        factor_applicability=(
            factor_for(selected_shipments[0].transport_method).applicability
            if selected_shipments
            else "No factor was applied because no valid rows matched the active filters."
        ),
        assumptions=unique_assumptions,
    )
