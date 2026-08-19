"""Small fictional dataset used to make a new demo workspace immediately useful."""

from __future__ import annotations

from dataclasses import dataclass

DEMO_SHIPMENTS_FILENAME = "carbonsage-demo-shipments.csv"
DEMO_SHIPMENTS_CSV = (
    b"shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
    b"distance_unit,transport_method\n"
    b"CS-1001,Edmonton,Calgary,12,mt,300,km,truck\n"
    b"CS-1002,Vancouver,Toronto,8,mt,4400,km,train\n"
    b"CS-1003,Shanghai,Vancouver,24,mt,10200,km,ocean container\n"
    b"CS-1004,Toronto,Montreal,4.5,mt,540,km,truck\n"
    b"CS-1005,Frankfurt,Toronto,1.2,mt,6350,km,plane\n"
    b"CS-1006,Calgary,Seattle,6,mt,1100,km,train\n"
)


@dataclass(frozen=True)
class DemoSupplier:
    name: str
    region: str
    certifications: str
    transport_modes: str


DEMO_SUPPLIERS = (
    DemoSupplier("Boreal Components", "Canada", "ISO 14001", "train, truck"),
    DemoSupplier("Northstar Logistics", "North America", "SmartWay", "truck, train"),
    DemoSupplier("Aurora Packaging", "Canada", "FSC, ISO 14001", "truck"),
    DemoSupplier("Prairie Steelworks", "Canada", "ISO 14001", "train, truck"),
    DemoSupplier("Cascade Textiles", "United States", "OEKO-TEX", "truck, ship"),
    DemoSupplier("Meridian Electronics", "Taiwan", "ISO 14001", "plane, ship"),
    DemoSupplier("Evergreen Polymers", "Canada", "ISCC PLUS", "train, truck"),
    DemoSupplier("Atlas Fasteners", "Mexico", "ISO 9001", "truck"),
    DemoSupplier("Pacific Circuitry", "Vietnam", "ISO 14001", "ship, plane"),
    DemoSupplier("Great Lakes Glass", "United States", "ENERGY STAR", "train, truck"),
    DemoSupplier("Summit Batteries", "South Korea", "RBA", "ship, plane"),
    DemoSupplier("Horizon Rubber", "Thailand", "ISO 14001", "ship"),
    DemoSupplier("Cedar Paper Co", "Canada", "FSC", "train, truck"),
    DemoSupplier("Arctic Insulation", "Canada", "GREENGUARD", "truck"),
    DemoSupplier("Riverbend Chemicals", "United States", "Responsible Care", "train, truck"),
    DemoSupplier("Terra Ceramics", "Spain", "ISO 14001", "ship, train"),
    DemoSupplier("Skyline Freight", "North America", "SmartWay", "truck, train"),
    DemoSupplier("Redwood Castings", "United States", "ISO 14001", "train, truck"),
    DemoSupplier("Bluewater Motors", "Germany", "ISO 50001", "ship, train"),
    DemoSupplier("Solstice Solar Materials", "Malaysia", "ISO 14001", "ship"),
    DemoSupplier("Nimbus Controls", "Japan", "ISO 14001", "plane, ship"),
    DemoSupplier("Frontier Composites", "Canada", "ISO 9001", "truck, train"),
    DemoSupplier("Maple Leaf Warehousing", "Canada", "LEED Gold", "truck, train"),
    DemoSupplier("Coastal Biofuels", "Canada", "ISCC", "ship, truck"),
)


@dataclass(frozen=True)
class DemoEvidenceSource:
    key: str
    filename: str
    supplier_name: str
    supplier_region: str
    certifications: str
    transport_modes: str
    content: bytes


DEMO_EVIDENCE_SOURCES = (
    DemoEvidenceSource(
        key="boreal-components-profile",
        filename="boreal-components-profile.txt",
        supplier_name="Boreal Components",
        supplier_region="Canada",
        certifications="ISO 14001",
        transport_modes="train, truck",
        content=(
            b"Fictional demo supplier profile for Boreal Components. The supplier holds "
            b"ISO 14001 certification. Its Edmonton facility reports 72 percent renewable "
            b"electricity and offers consolidated rail freight for qualifying Canadian routes. "
            b"The latest disclosure identifies recycled aluminium content as 38 percent and "
            b"lists supplier-specific energy data as independently reviewed."
        ),
    ),
    DemoEvidenceSource(
        key="northstar-logistics-disclosure",
        filename="northstar-logistics-disclosure.txt",
        supplier_name="Northstar Logistics",
        supplier_region="North America",
        certifications="SmartWay",
        transport_modes="truck, train",
        content=(
            b"Fictional demo logistics disclosure for Northstar Logistics. The carrier is a "
            b"SmartWay partner and reports a rail-intermodal option for lanes over 800 km. "
            b"Its disclosure estimates a 31 percent emissions reduction for eligible intermodal "
            b"routes compared with its conventional truck baseline. Refrigerated service and "
            b"last-mile delivery remain truck-only and should be evaluated separately."
        ),
    ),
    DemoEvidenceSource(
        key="aurora-packaging-disclosure",
        filename="aurora-packaging-disclosure.txt",
        supplier_name="Aurora Packaging",
        supplier_region="Canada",
        certifications="FSC, ISO 14001",
        transport_modes="truck",
        content=(
            b"Fictional demo sustainability disclosure for Aurora Packaging. The supplier "
            b"reports FSC-certified fibre for its corrugated packaging lines and maintains "
            b"ISO 14001 certification. Its 2025 disclosure states that recovered fibre made "
            b"up 81 percent of production inputs. Delivery data covers truck routes from the "
            b"Ontario facility; upstream forestry emissions are reported separately."
        ),
    ),
)


def generated_demo_source(key: str) -> tuple[str, str, bytes] | None:
    """Return a reproducible generated source for download without object storage."""

    if key == "shipment-baseline":
        return DEMO_SHIPMENTS_FILENAME, "text/csv", DEMO_SHIPMENTS_CSV
    for source in DEMO_EVIDENCE_SOURCES:
        if source.key == key:
            return source.filename, "text/plain", source.content
    return None
