"""PDF report: figures match the preview, graphics stay vector, layout survives edge data."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient
from pypdf import PdfReader

from main import app
from services.report_pdf import render_report_pdf
from tests.test_api import _upload_demo_shipments, authenticated_client


def _pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def _flat(text: str) -> str:
    return " ".join(text.split())


def _payload(**overrides):
    analysis = {
        "shipment_count": 0,
        "workspace_shipment_count": 0,
        "filtered_out_count": 0,
        "undated_shipment_count": 0,
        "total_weight_kg": 0.0,
        "total_emissions_kg": 0.0,
        "total_emissions_tonnes": 0.0,
        "mode_breakdown": {},
        "hotspots": [],
    }
    analysis.update(overrides.pop("analysis", {}))
    payload = {
        "workspace_id": "ws-test",
        "generated_at": 1_788_000_000,
        "shipment_analysis": analysis,
        "scenario": None,
        "suppliers": [],
        "methodology": {
            "factor_source": "Test factors",
            "factor_version": "1",
            "factor_applicability": "Applies to tests.",
            "assumptions": [],
            "warnings": [],
        },
    }
    payload.update(overrides)
    return payload


def test_pdf_download_matches_the_preview_and_csv_for_current_workspace_state():
    demo_client = authenticated_client()
    _upload_demo_shipments(demo_client)

    preview = demo_client.get("/reports/preview", params={"alternative_mode": "train"}).json()
    response = demo_client.get("/reports/export.pdf", params={"alternative_mode": "train"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "carbonsage-report.pdf" in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"%PDF-")
    text = _flat(_pdf_text(response.content))
    analysis = preview["shipment_analysis"]
    scenario = preview["scenario"]
    assert f"{analysis['total_emissions_kg']:,.2f}" in text
    assert f"{scenario['baseline_total_kg']:,.2f} kg" in text
    assert f"{scenario['alternative_total_kg']:,.2f} kg" in text
    assert f"{scenario['delta_kg']:,.2f} kg" in text
    assert "Test factors" not in text
    assert preview["methodology"]["factor_source"] in text
    assert "CALCULATED ESTIMATE" in text and "SUPPLIER DISCLOSURES" in text
    # CSV and PDF read the same report.
    csv = demo_client.get("/reports/export.csv", params={"alternative_mode": "train"})
    assert f"shipment_analysis,total_emissions_kg,{analysis['total_emissions_kg']}" in csv.text


def test_pdf_export_requires_a_workspace_session_and_validates_the_mode():
    assert TestClient(app).get("/reports/export.pdf").status_code == 401
    demo_client = authenticated_client()
    _upload_demo_shipments(demo_client)
    assert (
        demo_client.get(
            "/reports/export.pdf", params={"alternative_mode": "hovercraft"}
        ).status_code
        == 422
    )


def test_pdf_export_for_an_empty_workspace_labels_every_section():
    demo_client = authenticated_client()

    response = demo_client.get("/reports/export.pdf", params={"alternative_mode": "train"})

    assert response.status_code == 200
    text = _flat(_pdf_text(response.content))
    for heading in (
        "Key figures",
        "Emissions by mode",
        "Scenario comparison",
        "Highest-emitting shipments",
        "Supplier evidence overview",
        "Methodology",
        "Assumptions",
        "Warnings",
    ):
        assert heading in text
    assert "No shipment data in this workspace" in text
    assert "No suppliers in this workspace" in text
    assert "None recorded." in text


def test_pdf_charts_are_vector_graphics_not_images():
    modes = {
        "plane": {"shipment_count": 2, "weight_kg": 10.0, "emissions_kg": 300.0, "suppliers": []},
        "ship": {"shipment_count": 1, "weight_kg": 40.0, "emissions_kg": 12.5, "suppliers": []},
    }
    content = render_report_pdf(
        _payload(
            analysis={
                "shipment_count": 3,
                "total_emissions_kg": 312.5,
                "total_emissions_tonnes": 0.3125,
                "mode_breakdown": modes,
            }
        )
    )

    reader = PdfReader(io.BytesIO(content))
    assert all(not list(page.images) for page in reader.pages)
    text = _flat(_pdf_text(content))
    assert "300.00 kg" in text and "12.50 kg" in text
    assert "96.0%" in text and "4.0%" in text


def test_pdf_paginates_long_names_many_suppliers_and_untypeable_characters():
    long_name = "Extraordinarily" + "Long" * 80
    suppliers = [
        {
            "supplier_id": f"s{i}",
            "name": f"{long_name if i == 3 else f'Supplier {i}'} & <Sons>",
            "region": "東京 / Tokyo" if i == 2 else "Alberta",
            "certifications": ["ISO 14001", "SmartWay"],
            "transport_modes": ["truck", "train"],
            "document_count": i % 3,
            "missing_fields": ["region"] if i % 5 == 0 else [],
        }
        for i in range(120)
    ]
    hotspots = [
        {
            "shipment_id": f"S-{i}-" + "X" * 90,
            "shipment_date": None,
            "supplier_name": long_name,
            "origin": "Origin " * 20,
            "destination": "Destination " * 20,
            "transport_method": "truck",
            "emissions_kg": 1.5 * i,
        }
        for i in range(10)
    ]
    content = render_report_pdf(
        _payload(
            suppliers=suppliers,
            analysis={
                "shipment_count": 10,
                "total_emissions_kg": 82.5,
                "mode_breakdown": {
                    "truck": {
                        "shipment_count": 10,
                        "weight_kg": 5.0,
                        "emissions_kg": 82.5,
                        "suppliers": [
                            {"supplier_name": "Supplier 7 & <Sons>", "emissions_kg": 80.0},
                            {"supplier_name": "Not listed", "emissions_kg": 2.5},
                        ],
                    }
                },
                "hotspots": hotspots,
            },
        )
    )

    reader = PdfReader(io.BytesIO(content))
    assert len(reader.pages) >= 4
    text = _flat(_pdf_text(content))
    assert "Supplier 119 & <Sons>" in text
    assert "Shipment suppliers not in the supplier list" in text
    assert "Page 1 of" in text and f"Page {len(reader.pages)} of {len(reader.pages)}" in text
    assert reader.metadata.title == "CarbonSage decision report"
