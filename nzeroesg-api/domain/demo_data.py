"""Small fictional dataset used to make a new demo workspace immediately useful."""

from __future__ import annotations

from dataclasses import dataclass

DEMO_SHIPMENTS_FILENAME = "carbonsage-demo-shipments.csv"
DEMO_SHIPMENTS_CSV = (
    b"shipment_id,shipment_date,supplier_name,origin,destination,weight_value,weight_unit,"
    b"distance_value,distance_unit,transport_method\n"
    b"CS-1001,2025-09-04,Boreal Components,Edmonton,Calgary,12,mt,300,km,truck\n"
    b"CS-1002,2025-09-13,Northstar Logistics,Vancouver,Toronto,8,mt,4400,km,train\n"
    b"CS-1003,2025-09-25,Pacific Circuitry,Shanghai,Vancouver,24,mt,10200,km,ocean container\n"
    b"CS-1004,2025-10-06,Aurora Packaging,Toronto,Montreal,4.5,mt,540,km,truck\n"
    b"CS-1005,2025-10-17,Bluewater Motors,Frankfurt,Toronto,1.2,mt,6350,km,plane\n"
    b"CS-1006,2025-10-28,Prairie Steelworks,Calgary,Seattle,6,mt,1100,km,train\n"
    b"CS-1007,2025-11-05,Atlas Fasteners,Monterrey,Dallas,10,mt,950,km,truck\n"
    b"CS-1008,2025-11-16,Summit Batteries,Busan,Vancouver,18,mt,8500,km,ship\n"
    b"CS-1009,2025-11-24,Great Lakes Glass,Winnipeg,Toronto,7.5,mt,2050,km,train\n"
    b"CS-1010,2025-12-03,Cedar Paper Co,Montreal,Halifax,5.5,mt,1250,km,truck\n"
    b"CS-1011,2025-12-15,Nimbus Controls,Tokyo,Calgary,0.9,mt,8050,km,plane\n"
    b"CS-1012,2025-12-27,Bluewater Motors,Rotterdam,Montreal,21,mt,5700,km,ship\n"
    b"CS-1013,2026-01-08,Prairie Steelworks,Regina,Edmonton,11,mt,780,km,train\n"
    b"CS-1014,2026-01-19,Great Lakes Glass,Chicago,Toronto,9,mt,835,km,truck\n"
    b"CS-1015,2026-01-29,Pacific Circuitry,Ho Chi Minh City,Vancouver,16,mt,11800,km,ship\n"
    b"CS-1016,2026-02-07,Boreal Components,Calgary,Vancouver,6.5,mt,970,km,train\n"
    b"CS-1017,2026-02-18,Skyline Freight,Seattle,Edmonton,3.8,mt,1250,km,truck\n"
    b"CS-1018,2026-02-26,Summit Batteries,Seoul,Toronto,1.1,mt,10600,km,plane\n"
    b"CS-1019,2026-03-04,Aurora Packaging,Quebec City,Montreal,5,mt,255,km,truck\n"
    b"CS-1020,2026-03-14,Northstar Logistics,Vancouver,Winnipeg,13,mt,2300,km,train\n"
    b"CS-1021,2026-03-25,Terra Ceramics,Barcelona,Halifax,19,mt,5200,km,ship\n"
    b"CS-1022,2026-04-06,Redwood Castings,Portland,Vancouver,7,mt,505,km,truck\n"
    b"CS-1023,2026-04-17,Prairie Steelworks,Montreal,Calgary,10,mt,3550,km,train\n"
    b"CS-1024,2026-04-28,Nimbus Controls,Osaka,Toronto,0.8,mt,10400,km,plane\n"
    b"CS-1025,2026-05-05,Coastal Biofuels,Halifax,Montreal,22,mt,1250,km,ship\n"
    b"CS-1026,2026-05-16,Evergreen Polymers,Edmonton,Winnipeg,8.5,mt,1300,km,train\n"
    b"CS-1027,2026-05-27,Atlas Fasteners,Detroit,Toronto,6,mt,375,km,truck\n"
    b"CS-1028,2026-06-08,Frontier Composites,Calgary,Regina,4.8,mt,760,km,truck\n"
    b"CS-1029,2026-06-18,Bluewater Motors,Hamburg,Halifax,25,mt,5300,km,ship\n"
    b"CS-1030,2026-06-29,Northstar Logistics,Toronto,Vancouver,9,mt,4400,km,train\n"
    b"CS-1031,2026-07-07,Cascade Textiles,Los Angeles,Vancouver,5.5,mt,2050,km,truck\n"
    b"CS-1032,2026-07-19,Meridian Electronics,Taipei,Toronto,1,mt,12100,km,plane\n"
    b"CS-1033,2026-07-28,Cedar Paper Co,Prince Rupert,Montreal,15,mt,4750,km,train\n"
    b"CS-1034,2026-08-05,Boreal Components,Vancouver,Calgary,7.2,mt,970,km,train\n"
    b"CS-1035,2026-08-12,Solstice Solar Materials,Singapore,Vancouver,20,mt,12800,km,ship\n"
    b"CS-1036,2026-08-18,Aurora Packaging,Toronto,Vancouver,4.2,mt,4400,km,truck\n"
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
