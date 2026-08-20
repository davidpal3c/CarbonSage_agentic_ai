import io
from datetime import date

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
DATED_HEADER = (
    "shipment_id,shipment_date,origin,destination,weight_value,weight_unit,"
    "distance_value,distance_unit,transport_method\n"
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
    assert result.rows[0].shipment_date is None


def test_optional_shipment_dates_accept_aliases_and_reject_invalid_values():
    dated = parse_shipments_csv(
        b"shipment_id,departure_date,origin,destination,weight_value,weight_unit,"
        b"distance_value,distance_unit,transport_method\n"
        b"S-DATED,2026-03-14,Edmonton,Calgary,1,mt,100,km,train\n"
    )
    invalid = parse_shipments_csv(
        (DATED_HEADER + "S-BAD,2026-02-31,Edmonton,Calgary,1,mt,100,km,train\n").encode()
    )

    assert dated.errors == ()
    assert dated.rows[0].shipment_date == date(2026, 3, 14)
    assert invalid.rows == ()
    assert invalid.errors[0].field == "shipment_date"
    assert "ISO YYYY-MM-DD" in invalid.errors[0].message


def test_optional_supplier_alias_is_normalized_and_used_in_mode_analysis():
    parsed = parse_shipments_csv(
        b"shipment_id,vendor,origin,destination,weight_value,weight_unit,"
        b"distance_value,distance_unit,transport_method\n"
        b"S-001,Northstar Logistics,Toronto,Vancouver,1,mt,4400,km,train\n"
        b"S-002,Aurora Packaging,Toronto,Vancouver,1,mt,4400,km,truck\n"
    )

    assert parsed.errors == ()
    assert parsed.rows[0].supplier_name == "Northstar Logistics"
    analysis = analyze_shipments(parsed.rows)
    assert analysis.mode_breakdown["train"].suppliers[0].supplier_name == ("Northstar Logistics")
    assert analysis.mode_breakdown["truck"].suppliers[0].supplier_name == ("Aurora Packaging")


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
    assert analysis.undated_shipment_count == 2
    assert analysis.timeline[0].period == "Undated"


def test_dated_analytics_reconcile_month_year_mode_and_date_filters():
    parsed = parse_shipments_csv(
        (
            DATED_HEADER
            + "S-001,2025-12-05,Edmonton,Calgary,1,mt,100,km,truck\n"
            + "S-002,2026-01-12,Calgary,Vancouver,2,mt,1000,km,train\n"
            + "S-003,2026-01-25,Vancouver,Toronto,1,mt,4000,km,plane\n"
        ).encode()
    )

    monthly = analyze_shipments(parsed.rows, granularity="month")
    yearly = analyze_shipments(parsed.rows, granularity="year")
    filtered = analyze_shipments(
        parsed.rows,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        modes=("train",),
    )

    assert monthly.shipment_count == 3
    assert [period.period for period in monthly.timeline] == ["2025-12", "2026-01"]
    assert round(sum(period.emissions_kg for period in monthly.timeline), 6) == (
        monthly.total_emissions_kg
    )
    assert (
        round(
            sum(sum(period.mode_emissions_kg.values()) for period in monthly.timeline),
            6,
        )
        == monthly.total_emissions_kg
    )
    assert [period.period for period in yearly.timeline] == ["2025", "2026"]
    assert filtered.shipment_count == 1
    assert filtered.filtered_out_count == 2
    assert filtered.mode_breakdown["train"].emissions_kg == 44.0


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
