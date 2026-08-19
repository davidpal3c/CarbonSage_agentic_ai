import io

from openpyxl import Workbook

from domain.shipments.analysis import analyze_shipments
from domain.shipments.ingestion import (
    MAX_FILE_BYTES,
    MAX_ROWS,
    parse_shipments_csv,
    parse_shipments_xlsx,
)

HEADER = (
    "shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
    "distance_unit,transport_method\n"
)


def test_valid_csv_normalizes_units_and_aliases():
    result = parse_shipments_csv(
        (
            HEADER
            + "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
            + "S-002,Calgary,Vancouver,500,g,62.1371,mi,rail\n"
        ).encode(),
        content_type="text/csv",
        filename="shipments.csv",
    )

    assert result.errors == ()
    assert result.rows[0].weight_kg == 1_000
    assert result.rows[1].weight_kg == 0.5
    assert result.rows[1].distance_km == 99.999721
    assert result.rows[1].transport_method == "train"


def test_partial_csv_keeps_valid_rows_and_reports_row_level_errors():
    result = parse_shipments_csv(
        (
            HEADER
            + "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
            + "S-002,,Vancouver,-2,kg,not-a-distance,km,submarine\n"
        ).encode()
    )

    assert len(result.rows) == 1
    assert {issue.field for issue in result.errors} == {
        "origin",
        "weight_value",
        "distance_value",
        "transport_method",
    }
    assert result.errors[0].row_number == 3
    assert result.warnings == ("Some input rows were rejected; totals include accepted rows only.",)


def test_analysis_returns_reconcilable_totals_breakdown_and_hotspots():
    parsed = parse_shipments_csv(
        (
            HEADER
            + "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
            + "S-002,Calgary,Vancouver,500,kg,1000,km,plane\n"
        ).encode()
    )

    analysis = analyze_shipments(parsed.rows, parser_warnings=parsed.warnings)

    assert analysis.shipment_count == 2
    assert analysis.total_emissions_kg == 307.2
    assert analysis.mode_breakdown["plane"].emissions_kg == 301.0
    assert analysis.hotspots[0].shipment_id == "S-002"
    assert analysis.factor_version == "prototype-2026.1"
    assert analysis.assumptions


def test_parser_rejects_missing_headers_bad_file_type_and_nul_content():
    missing_headers = parse_shipments_csv(b"shipment_id,origin\nS-001,Edmonton\n")
    bad_type = parse_shipments_csv(HEADER.encode(), content_type="application/pdf")
    hostile = parse_shipments_csv(
        (HEADER + "S-001,Ed\x00monton,Calgary,1,mt,100,km,truck\n").encode()
    )

    assert "Missing required headers" in missing_headers.errors[0].message
    assert bad_type.errors[0].message == "File must use a CSV-compatible content type."
    assert hostile.errors[0].message == "NUL characters are not allowed in CSV content."


def test_supplier_export_gets_a_clear_shipment_import_explanation():
    result = parse_shipments_csv(
        b"supplier_id,name,region,certifications,transport_modes,documents\n"
    )

    assert result.rows == ()
    assert result.errors[0].message == (
        "This looks like supplier data. Add supplier records from the Suppliers page, "
        "or choose a shipment CSV/XLSX file here."
    )


def test_parser_rejects_oversized_and_over_row_limit_files():
    oversized = parse_shipments_csv(b"x" * (MAX_FILE_BYTES + 1))
    rows = HEADER + "".join(
        f"S-{row_number},Edmonton,Calgary,1,kg,100,km,truck\n" for row_number in range(MAX_ROWS + 1)
    )
    over_rows = parse_shipments_csv(rows.encode())

    assert oversized.errors[0].message == "File exceeds the 10 MB limit."
    assert len(over_rows.rows) == MAX_ROWS
    assert over_rows.errors[-1].message == f"CSV cannot contain more than {MAX_ROWS} data rows."


def test_xlsx_parser_accepts_common_header_aliases():
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(
        (
            "Shipment",
            "From",
            "To",
            "Weight",
            "Weight UOM",
            "Distance",
            "Distance UOM",
            "Transport mode",
        )
    )
    worksheet.append(("S-XLSX", "Edmonton", "Calgary", 1, "mt", 300, "km", "truck"))
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()

    result = parse_shipments_xlsx(
        output.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="shipments.xlsx",
    )

    assert result.errors == ()
    assert result.rows[0].shipment_id == "S-XLSX"
    assert result.rows[0].weight_kg == 1_000
