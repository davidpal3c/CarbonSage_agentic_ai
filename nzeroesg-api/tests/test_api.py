import pytest
from fastapi.testclient import TestClient

import api.agent as agent_api
import api.evidence as evidence_api
from domain.agent.tools import AgentPlan, AgentToolName, PlannedToolCall
from domain.evidence.embeddings import (
    EMBEDDING_DIMENSIONS,
    EmbeddingProviderError,
    EmbeddingSpec,
)
from main import app

client = TestClient(app)


class FixtureEmbeddingAdapter:
    spec = EmbeddingSpec(provider="fixture", model="semantic-v1")

    @staticmethod
    def _vector(text: str) -> tuple[float, ...]:
        values = [0.0] * EMBEDDING_DIMENSIONS
        normalized = text.casefold()
        if any(term in normalized for term in ("rail", "lower transport emissions")):
            values[0] = 1.0
        else:
            values[1] = 1.0
        return tuple(values)

    def embed_documents(self, texts):
        return tuple(self._vector(text) for text in texts)

    def embed_query(self, text):
        return self._vector(text)


class FailingEmbeddingAdapter(FixtureEmbeddingAdapter):
    def embed_documents(self, texts):
        raise EmbeddingProviderError("fixture provider unavailable")

    def embed_query(self, text):
        raise EmbeddingProviderError("fixture provider unavailable")


class FixtureAgentPlanner:
    async def plan(self, *, question, history, tool_schemas):
        assert question == "Estimate one tonne by rail for 100 km."
        assert "calculate_freight_emissions" in tool_schemas
        return AgentPlan(
            calls=[
                PlannedToolCall(
                    call_id="api-calculation",
                    tool_name=AgentToolName.CALCULATE_FREIGHT_EMISSIONS,
                    arguments={
                        "weight_value": 1,
                        "weight_unit": "mt",
                        "distance_value": 100,
                        "distance_unit": "km",
                        "transport_method": "train",
                    },
                )
            ]
        )


def authenticated_client() -> TestClient:
    demo_client = TestClient(app)
    response = demo_client.post("/demo/session")
    assert response.status_code == 201
    return demo_client


def test_health_is_available_without_provider_credentials():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "environment": "development",
        "assistant_enabled": False,
        "semantic_search_enabled": False,
        "artifact_storage_enabled": False,
    }
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_evidence_upload_rejects_oversized_content_before_extraction():
    response = authenticated_client().post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={
            "file": (
                "supplier.txt",
                b"x" * (10 * 1024 * 1024 + 1),
                "text/plain",
            )
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Evidence file exceeds the 10 MB limit."


def test_cors_allows_frontend_workspace_logout():
    response = client.options(
        "/demo/session",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "DELETE",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
    assert "DELETE" in response.headers["access-control-allow-methods"]
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_transitional_chat_route_is_removed():
    response = client.post("/chat", json={"message": "Compare rail and air."})

    assert response.status_code == 404


def test_typed_agent_health_exposes_versioned_local_contracts():
    response = client.get("/agent/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "available": False,
        "policy_version": "1.0",
        "response_schema_version": "1.0",
    }


def test_agent_conversations_require_a_workspace_and_disabled_submission_is_explicit():
    assert client.post("/agent/conversations", json={}).status_code == 401
    demo_client = authenticated_client()
    created = demo_client.post("/agent/conversations", json={})

    assert created.status_code == 201
    conversation_id = created.json()["conversation_id"]
    response = demo_client.post(
        f"/agent/conversations/{conversation_id}/messages",
        json={"content": "Compare rail and air."},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == ("The CarbonSage agent is disabled in this environment.")


def test_typed_agent_api_returns_validated_blocks_and_enforces_workspace_scope(
    monkeypatch,
):
    monkeypatch.setattr(agent_api.agent_runtime_service, "planner", FixtureAgentPlanner())
    owner = authenticated_client()
    other_workspace = authenticated_client()
    created = owner.post(
        "/agent/conversations",
        json={"title": "Freight decision"},
    )
    assert created.status_code == 201
    conversation_id = created.json()["conversation_id"]

    exchange = owner.post(
        f"/agent/conversations/{conversation_id}/messages",
        json={"content": "Estimate one tonne by rail for 100 km."},
    )

    assert exchange.status_code == 200
    response = exchange.json()["assistant_message"]["response"]
    assert response["schema_version"] == "1.0"
    assert response["policy_version"] == "1.0"
    assert response["evidence_status"] == "not_required"
    metric = next(block for block in response["blocks"] if block["type"] == "metric")
    assert metric == {
        "type": "metric",
        "label": "Train emissions",
        "value": 2.2,
        "unit": "kg CO2e",
        "context": "1000 kg over 100 km · prototype-2026.1",
    }
    owner_session = owner.get("/demo/session").json()
    assert owner_session["quotas"]["assistant_requests_per_day"]["used"] == 1
    assert other_workspace.get(f"/agent/conversations/{conversation_id}").status_code == 404


def test_deterministic_emissions_endpoint_returns_provenance_without_assistant():
    response = authenticated_client().post(
        "/emissions/calculate",
        json={
            "weight_value": 1,
            "weight_unit": "mt",
            "distance_value": 100,
            "distance_unit": "km",
            "transport_method": "train",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["emissions_kg"] == 2.2
    assert payload["source_version"] == "prototype-2026.1"
    assert payload["assumptions"]
    assert payload["provenance"]["distance"]["method"] == "route"


def test_deterministic_comparison_endpoint_orders_modes_and_exposes_warnings():
    response = authenticated_client().post(
        "/emissions/compare",
        json={
            "weight_value": 500,
            "distance_value": 1_000,
            "transport_method": ["plane", "truck", "ship"],
            "distance_method": "straight_line",
            "origin": "Edmonton",
            "destination": "Calgary",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["lowest_emissions_method"] == "ship"
    assert list(payload["details"]) == ["plane", "truck", "ship"]
    assert payload["details"]["ship"]["warnings"]


def test_emissions_endpoint_rejects_direct_calls_without_workspace_session():
    response = TestClient(app).post(
        "/emissions/calculate",
        json={
            "weight_value": 1,
            "distance_value": 100,
            "transport_method": "truck",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "A valid workspace session is required."


def test_demo_sessions_are_isolated_between_browser_clients():
    first_client = authenticated_client()
    second_client = authenticated_client()

    first_session = first_client.get("/demo/session")
    second_session = second_client.get("/demo/session")

    assert first_session.status_code == 200
    assert second_session.status_code == 200
    assert first_session.json()["workspace_id"] != second_session.json()["workspace_id"]
    assert first_session.json()["retention"]["policy"] == "workspace_and_derived_data"


def test_demo_logout_removes_the_session_cookie():
    demo_client = authenticated_client()

    response = demo_client.delete("/demo/session")

    assert response.status_code == 204
    assert demo_client.get("/demo/session").status_code == 401


def test_demo_data_is_explicit_idempotent_and_downloadable():
    demo_client = authenticated_client()

    empty = demo_client.get("/demo/data")
    loaded = demo_client.post("/demo/data")
    repeated = demo_client.post("/demo/data")

    assert empty.status_code == 200
    assert empty.json()["has_artifacts"] is False
    assert loaded.status_code == 200
    assert loaded.json() == {
        "loaded": True,
        "has_artifacts": True,
        "artifact_count": 4,
        "shipment_count": 6,
        "supplier_count": 24,
        "evidence_document_count": 3,
    }
    assert repeated.status_code == 200
    assert repeated.json()["loaded"] is True
    assert repeated.json()["artifact_count"] == 4

    artifacts = demo_client.get("/artifacts").json()["artifacts"]
    for artifact in artifacts:
        download = demo_client.get(f"/artifacts/{artifact['artifact_id']}/content")
        assert download.status_code == 200
        assert download.content

    shipments_export = demo_client.get("/shipments/export")
    suppliers_export = demo_client.get("/suppliers/export")
    assert shipments_export.status_code == 200
    assert b"CS-1001" in shipments_export.content
    assert suppliers_export.status_code == 200
    assert b"Boreal Components" in suppliers_export.content
    assert b"Coastal Biofuels" in suppliers_export.content


def test_demo_data_can_be_unloaded_without_removing_user_uploads():
    demo_client = authenticated_client()
    assert demo_client.post("/demo/data").status_code == 200

    user_shipments = demo_client.post(
        "/shipments/upload",
        files={
            "file": (
                "user-shipments.csv",
                (
                    b"shipment_id,origin,destination,weight_value,weight_unit,"
                    b"distance_value,distance_unit,transport_method\n"
                    b"USER-001,Edmonton,Calgary,1000,kg,300,km,truck\n"
                ),
                "text/csv",
            )
        },
    )
    assert user_shipments.status_code == 200

    user_evidence = demo_client.post(
        "/evidence/upload",
        data={"supplier_name": "User Supplier", "supplier_region": "Canada"},
        files={
            "file": (
                "user-supplier.txt",
                b"User Supplier maintains ISO 14001 certification.",
                "text/plain",
            )
        },
    )
    assert user_evidence.status_code == 200

    unloaded = demo_client.delete("/demo/data")

    assert unloaded.status_code == 200
    assert unloaded.json() == {
        "loaded": False,
        "has_artifacts": True,
        "artifact_count": 2,
        "shipment_count": 1,
        "supplier_count": 1,
        "evidence_document_count": 1,
    }
    assert {
        artifact["title"] for artifact in demo_client.get("/artifacts").json()["artifacts"]
    } == {"user-shipments.csv", "user-supplier.txt"}
    assert [supplier["name"] for supplier in demo_client.get("/suppliers").json()["suppliers"]] == [
        "User Supplier"
    ]
    shipments = demo_client.get("/shipments").json()
    assert shipments["accepted_rows"] == 1
    assert shipments["rows"][0]["shipment_id"] == "USER-001"


def test_supplier_can_be_created_before_evidence_is_available():
    demo_client = authenticated_client()

    response = demo_client.post(
        "/suppliers",
        json={
            "name": "Prairie Packaging",
            "region": "Canada",
            "certifications": ["ISO 14001"],
            "transport_modes": ["rail"],
        },
    )

    assert response.status_code == 201
    assert response.json()["document_count"] == 0
    suppliers = demo_client.get("/suppliers").json()["suppliers"]
    assert [supplier["name"] for supplier in suppliers] == ["Prairie Packaging"]


def test_analysis_run_is_persisted_in_workspace_quota():
    demo_client = authenticated_client()

    response = demo_client.post(
        "/emissions/calculate",
        json={
            "weight_value": 1,
            "distance_value": 100,
            "transport_method": "truck",
        },
    )

    assert response.status_code == 200
    session = demo_client.get("/demo/session")
    assert session.status_code == 200
    assert session.json()["quotas"]["analysis_runs_per_day"] == {"used": 1, "limit": 10}


def test_analysis_quota_rejects_the_eleventh_run():
    demo_client = authenticated_client()
    payload = {
        "weight_value": 1,
        "distance_value": 100,
        "transport_method": "truck",
    }

    for _ in range(10):
        assert demo_client.post("/emissions/calculate", json=payload).status_code == 200

    response = demo_client.post("/emissions/calculate", json=payload)

    assert response.status_code == 429
    assert response.json()["detail"] == (
        "The daily analysis quota for this workspace has been reached."
    )


def test_shipment_upload_returns_valid_rows_errors_and_analysis():
    demo_client = authenticated_client()
    csv_content = (
        "shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
        "distance_unit,transport_method\n"
        "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
        "S-002,,Vancouver,-2,kg,not-a-distance,km,submarine\n"
    )

    response = demo_client.post(
        "/shipments/upload",
        files={"file": ("shipments.csv", csv_content.encode(), "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accepted_rows"] == 1
    assert payload["rows"][0]["shipment_id"] == "S-001"
    assert payload["analysis"]["total_emissions_kg"] == 6.2
    assert payload["errors"][0]["row_number"] == 3
    assert payload["warnings"]


def test_shipment_records_are_workspace_isolated():
    first_client = authenticated_client()
    second_client = authenticated_client()
    csv_content = (
        "shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
        "distance_unit,transport_method\n"
        "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
    )

    upload = first_client.post(
        "/shipments/upload",
        files={"file": ("shipments.csv", csv_content, "text/csv")},
    )

    assert upload.status_code == 200
    assert first_client.get("/shipments").json()["accepted_rows"] == 1
    assert second_client.get("/shipments").json()["accepted_rows"] == 0


def test_shipment_upload_requires_a_workspace_session():
    response = TestClient(app).post(
        "/shipments/upload",
        files={"file": ("shipments.csv", b"shipment_id\nS-001\n", "text/csv")},
    )

    assert response.status_code == 401


def test_evidence_upload_and_search_return_recoverable_citation():
    demo_client = authenticated_client()
    evidence = b"Supplier ABC holds ISO 14001 certification and operates rail routes."

    upload = demo_client.post(
        "/evidence/upload",
        data={
            "supplier_name": "Supplier ABC",
            "supplier_region": "Canada",
            "certifications": "ISO 14001",
            "transport_modes": "rail, truck",
        },
        files={"file": ("supplier.txt", evidence, "text/plain")},
    )

    assert upload.status_code == 200
    assert upload.json()["supplier"]["missing_fields"] == []
    assert upload.json()["chunk_count"] == 1

    search = demo_client.get("/evidence/search", params={"query": "ISO 14001"})

    assert search.status_code == 200
    match = search.json()["matches"][0]
    assert match["supplier_name"] == "Supplier ABC"
    assert match["citation"]["filename"] == "supplier.txt"
    assert match["citation"]["chunk_index"] == 0
    assert "ISO 14001" in match["excerpt"]


def test_evidence_semantic_and_hybrid_modes_use_versioned_embeddings(monkeypatch):
    monkeypatch.setattr(evidence_api, "embedding_adapter", FixtureEmbeddingAdapter())
    first_client = authenticated_client()
    second_client = authenticated_client()

    upload = first_client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={
            "file": (
                "supplier.txt",
                b"Supplier ABC shifts freight from road to lower-emission rail routes.",
                "text/plain",
            )
        },
    )

    assert upload.status_code == 200
    assert upload.json()["embedding_status"] == "indexed"
    semantic = first_client.get(
        "/evidence/search",
        params={"query": "lower transport emissions", "mode": "semantic"},
    )
    hybrid = first_client.get(
        "/evidence/search",
        params={"query": "rail", "mode": "hybrid"},
    )
    isolated = second_client.get(
        "/evidence/search",
        params={"query": "lower transport emissions", "mode": "semantic"},
    )

    assert semantic.status_code == 200
    assert semantic.json()["mode"] == "semantic"
    assert semantic.json()["matches"][0]["citation"]["filename"] == "supplier.txt"
    assert semantic.json()["matches"][0]["retrieval"]["semantic_rank"] == 1
    assert hybrid.status_code == 200
    assert hybrid.json()["mode"] == "hybrid"
    assert hybrid.json()["matches"][0]["retrieval"] == {
        "mode": "hybrid",
        "score": pytest.approx(2 / 61),
        "lexical_rank": 1,
        "semantic_rank": 1,
    }
    assert isolated.status_code == 200
    assert isolated.json()["matches"] == []


def test_semantic_mode_reports_when_embedding_provider_is_unavailable():
    demo_client = authenticated_client()

    semantic = demo_client.get(
        "/evidence/search",
        params={"query": "supplier policy", "mode": "semantic"},
    )
    hybrid = demo_client.get(
        "/evidence/search",
        params={"query": "supplier policy", "mode": "hybrid"},
    )

    assert semantic.status_code == 503
    assert hybrid.status_code == 200
    assert hybrid.json()["mode"] == "lexical"
    assert hybrid.json()["warning"]


def test_provider_failure_preserves_upload_and_hybrid_uses_lexical_fallback(monkeypatch):
    monkeypatch.setattr(evidence_api, "embedding_adapter", FailingEmbeddingAdapter())
    demo_client = authenticated_client()

    upload = demo_client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={
            "file": (
                "supplier.txt",
                b"Supplier ABC holds ISO 14001 certification.",
                "text/plain",
            )
        },
    )
    hybrid = demo_client.get(
        "/evidence/search",
        params={"query": "ISO 14001", "mode": "hybrid"},
    )

    assert upload.status_code == 200
    assert upload.json()["embedding_status"] == "failed"
    assert hybrid.status_code == 200
    assert hybrid.json()["mode"] == "lexical"
    assert hybrid.json()["semantic_available"] is False
    assert hybrid.json()["matches"][0]["citation"]["filename"] == "supplier.txt"
    assert "Semantic retrieval failed" in hybrid.json()["warning"]


def test_semantic_search_lazily_indexes_existing_workspace_documents(monkeypatch):
    demo_client = authenticated_client()
    upload = demo_client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={
            "file": (
                "existing.txt",
                b"Supplier ABC shifts freight from road to lower-emission rail routes.",
                "text/plain",
            )
        },
    )
    assert upload.json()["embedding_status"] == "not_configured"

    monkeypatch.setattr(evidence_api, "embedding_adapter", FixtureEmbeddingAdapter())
    semantic = demo_client.get(
        "/evidence/search",
        params={"query": "lower transport emissions", "mode": "semantic"},
    )

    assert semantic.status_code == 200
    assert semantic.json()["matches"][0]["citation"]["filename"] == "existing.txt"


def test_evidence_documents_are_workspace_isolated_and_quota_limited():
    first_client = authenticated_client()
    second_client = authenticated_client()
    evidence = b"Supplier ABC holds ISO 14001 certification."

    for index in range(3):
        response = first_client.post(
            "/evidence/upload",
            data={"supplier_name": f"Supplier {index}"},
            files={"file": (f"supplier-{index}.txt", evidence + str(index).encode(), "text/plain")},
        )
        assert response.status_code == 200

    exceeded = first_client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier 4"},
        files={"file": ("supplier-4.txt", evidence, "text/plain")},
    )

    assert exceeded.status_code == 429
    assert first_client.get("/suppliers").json()["suppliers"]
    assert second_client.get("/suppliers").json()["suppliers"] == []


def test_evidence_upload_requires_a_workspace_session():
    response = TestClient(app).post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={"file": ("supplier.txt", b"ISO 14001", "text/plain")},
    )

    assert response.status_code == 401


def _upload_demo_shipments(demo_client: TestClient) -> None:
    csv_content = (
        "shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
        "distance_unit,transport_method\n"
        "S-001,Edmonton,Calgary,1,mt,100,km,truck\n"
    )
    response = demo_client.post(
        "/shipments/upload",
        files={"file": ("shipments.csv", csv_content, "text/csv")},
    )
    assert response.status_code == 200


def test_scenario_comparison_reconciles_with_the_stored_shipment_analysis():
    demo_client = authenticated_client()
    _upload_demo_shipments(demo_client)

    response = demo_client.post(
        "/scenarios/compare",
        json={"alternative_transport_method": "train"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["baseline_total_kg"] == 6.2
    assert payload["alternative_total_kg"] == 2.2
    assert payload["delta_kg"] == -4.0
    assert payload["shipment_results"][0]["delta_kg"] == -4.0


def test_report_preview_and_csv_export_share_current_workspace_state():
    demo_client = authenticated_client()
    _upload_demo_shipments(demo_client)

    preview = demo_client.get("/reports/preview", params={"alternative_mode": "train"})
    export = demo_client.get("/reports/export.csv", params={"alternative_mode": "train"})

    assert preview.status_code == 200
    assert preview.json()["shipment_analysis"]["total_emissions_kg"] == 6.2
    assert preview.json()["scenario"]["alternative_total_kg"] == 2.2
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "shipment_analysis,total_emissions_kg,6.2" in export.text
    assert "scenario,alternative_total_kg,2.2" in export.text


def test_scenario_and_report_routes_require_a_workspace_session():
    response = TestClient(app).post(
        "/scenarios/compare",
        json={"alternative_transport_method": "train"},
    )
    report = TestClient(app).get("/reports/preview")

    assert response.status_code == 401
    assert report.status_code == 401
