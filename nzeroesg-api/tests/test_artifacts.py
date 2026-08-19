from fastapi.testclient import TestClient

import api.artifacts as artifacts_api
from domain.artifacts.storage import ArtifactStoragePolicy
from domain.workspaces.principals import AuthenticationMethod, WorkspacePrincipal
from domain.workspaces.sessions import WorkspaceSession
from integrations.aws_s3 import InMemoryObjectStore
from main import app
from persistence.artifact_storage import InMemoryArtifactStorageRepository
from services.artifact_storage import ArtifactStorageService

SHIPMENT_CSV = (
    b"shipment_id,origin,destination,weight_value,weight_unit,distance_value,"
    b"distance_unit,transport_method\n"
    b"SHP-001,Calgary,Vancouver,1000,kg,970,km,truck\n"
)


def authenticated_client() -> TestClient:
    client = TestClient(app)
    assert client.post("/demo/session").status_code == 201
    return client


def upload_shipments(client: TestClient):
    return client.post(
        "/shipments/upload",
        files={"file": ("shipments.csv", SHIPMENT_CSV, "text/csv")},
    )


def test_demo_session_resolves_to_the_common_workspace_principal():
    session = WorkspaceSession.create(workspace_id="demo-principal", issued_at=100, ttl_seconds=60)

    principal = WorkspacePrincipal.from_demo_session(session)

    assert principal.workspace_id == "demo-principal"
    assert principal.subject == "demo:demo-principal"
    assert principal.authentication_method is AuthenticationMethod.DEMO_SESSION
    assert principal.allows("artifacts:read")
    assert not principal.allows("embed-clients:write")


def test_shipment_artifact_crud_is_workspace_scoped_and_deletion_hides_data():
    owner = authenticated_client()
    other = authenticated_client()

    upload = upload_shipments(owner)
    assert upload.status_code == 200
    artifact = upload.json()["artifact"]
    artifact_id = artifact["artifact_id"]
    assert artifact["kind"] == "shipment_dataset"
    assert artifact["status"] == "ready"
    assert artifact["source_type"] == "local_upload"
    assert artifact["metadata"]["accepted_rows"] == 1
    assert artifact["metadata"]["source_retention"]["status"] == "ephemeral"

    listed = owner.get("/artifacts")
    assert listed.status_code == 200
    assert [item["artifact_id"] for item in listed.json()["artifacts"]] == [artifact_id]
    assert other.get(f"/artifacts/{artifact_id}").status_code == 404
    assert other.patch(f"/artifacts/{artifact_id}", json={"title": "Leaked"}).status_code == 404
    assert other.delete(f"/artifacts/{artifact_id}").status_code == 404

    renamed = owner.patch(
        f"/artifacts/{artifact_id}",
        json={"title": "  Q3   freight baseline  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Q3 freight baseline"

    deleted = owner.delete(f"/artifacts/{artifact_id}")
    assert deleted.status_code == 204
    assert owner.get(f"/artifacts/{artifact_id}").status_code == 404
    assert owner.get("/artifacts").json()["artifacts"] == []
    assert owner.get("/shipments").json()["accepted_rows"] == 0


def test_retained_shipment_source_is_private_downloadable_and_deleted(monkeypatch):
    storage = ArtifactStorageService(
        enabled=True,
        repository=InMemoryArtifactStorageRepository(),
        policy=ArtifactStoragePolicy(),
        object_store=InMemoryObjectStore(),
        bucket="carbonsage-test",
    )
    monkeypatch.setattr(artifacts_api, "artifact_storage_service", storage)
    owner = authenticated_client()
    other = authenticated_client()

    uploaded = upload_shipments(owner)

    assert uploaded.status_code == 200
    artifact = uploaded.json()["artifact"]
    artifact_id = artifact["artifact_id"]
    assert artifact["metadata"]["source_retention"]["status"] == "retained"
    assert artifact["metadata"]["source_retention"]["size_bytes"] == len(SHIPMENT_CSV)
    assert other.get(f"/artifacts/{artifact_id}/content").status_code == 404

    downloaded = owner.get(f"/artifacts/{artifact_id}/content")
    assert downloaded.status_code == 200
    assert downloaded.content == SHIPMENT_CSV
    assert downloaded.headers["content-type"] == "text/csv; charset=utf-8"
    assert downloaded.headers["cache-control"] == "private, no-store"
    assert downloaded.headers["x-content-sha256"] == artifact["content_sha256"]

    assert owner.delete(f"/artifacts/{artifact_id}").status_code == 204
    assert owner.get(f"/artifacts/{artifact_id}/content").status_code == 404


def test_evidence_artifact_identity_flows_to_citations_and_delete_hides_evidence():
    client = authenticated_client()
    upload = client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC", "supplier_region": "Canada"},
        files={
            "file": (
                "supplier.txt",
                b"Supplier ABC maintains ISO 14001 certification and prioritizes rail freight.",
                "text/plain",
            )
        },
    )
    assert upload.status_code == 200
    artifact_id = upload.json()["artifact"]["artifact_id"]

    search = client.get("/evidence/search", params={"query": "ISO 14001"})
    assert search.status_code == 200
    assert search.json()["matches"][0]["citation"]["artifact_id"] == artifact_id

    duplicate = client.post(
        "/evidence/upload",
        data={"supplier_name": "Supplier ABC"},
        files={
            "file": (
                "supplier-copy.txt",
                b"Supplier ABC maintains ISO 14001 certification and prioritizes rail freight.",
                "text/plain",
            )
        },
    )
    assert duplicate.status_code == 409

    assert client.delete(f"/artifacts/{artifact_id}").status_code == 204
    suppliers = client.get("/suppliers").json()["suppliers"]
    assert len(suppliers) == 1
    assert suppliers[0]["document_count"] == 0
    assert client.get("/evidence/search", params={"query": "ISO 14001"}).json()["matches"] == []


def test_report_snapshot_is_typed_recoverable_and_soft_deletable():
    client = authenticated_client()
    assert upload_shipments(client).status_code == 200

    created = client.post(
        "/reports/snapshots",
        json={"title": "Rail decision", "alternative_mode": "train"},
    )
    assert created.status_code == 201
    payload = created.json()
    artifact_id = payload["artifact"]["artifact_id"]
    assert payload["artifact"]["kind"] == "report_snapshot"
    assert payload["schema_version"] == "1.0"
    assert payload["report"]["scenario"]["alternative_mode"] == "train"

    recovered = client.get(f"/reports/snapshots/{artifact_id}")
    assert recovered.status_code == 200
    assert recovered.json()["report"] == payload["report"]

    assert client.delete(f"/artifacts/{artifact_id}").status_code == 204
    assert client.get(f"/reports/snapshots/{artifact_id}").status_code == 404


def test_report_snapshot_requires_an_active_shipment_dataset():
    response = authenticated_client().post("/reports/snapshots", json={})

    assert response.status_code == 422
    assert response.json()["detail"] == "A report snapshot requires an active shipment dataset."
