import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from hashlib import sha256
from io import BytesIO

import pytest

from domain.artifacts.models import ArtifactKind, ArtifactSourceType, create_artifact
from domain.artifacts.storage import (
    ArtifactObject,
    ArtifactObjectStatus,
    ArtifactStorageBudgetExceededError,
    ArtifactStorageNotFoundError,
    ArtifactStoragePolicy,
)
from integrations.aws_s3 import InMemoryObjectStore, S3ObjectStore
from persistence.artifact_storage import (
    InMemoryArtifactStorageRepository,
    PostgresArtifactStorageRepository,
)
from persistence.workspaces import build_workspace_repository
from services.artifact_storage import ArtifactStorageService


def artifact_for(content: bytes, *, workspace_id: str = "demo-storage"):
    return create_artifact(
        workspace_id=workspace_id,
        kind=ArtifactKind.EVIDENCE_DOCUMENT,
        title="evidence.txt",
        source_type=ArtifactSourceType.LOCAL_UPLOAD,
        created_by="test",
        media_type="text/plain",
        content_sha256=sha256(content).hexdigest(),
    )


def service_for(policy: ArtifactStoragePolicy | None = None):
    repository = InMemoryArtifactStorageRepository()
    object_store = InMemoryObjectStore()
    service = ArtifactStorageService(
        enabled=True,
        repository=repository,
        policy=policy or ArtifactStoragePolicy(),
        object_store=object_store,
        bucket="carbonsage-test",
    )
    return service, repository, object_store


def test_default_policy_leaves_margin_below_fifty_cent_s3_ceiling():
    policy = ArtifactStoragePolicy()

    assert policy.estimated_maximum_monthly_cost_usd() == Decimal("0.3790")
    assert policy.estimated_maximum_monthly_cost_usd() < policy.billing_ceiling_usd


def test_policy_rejects_limits_that_cross_the_approved_cost_ceiling():
    with pytest.raises(ValueError, match="billing ceiling"):
        ArtifactStoragePolicy(max_egress_bytes_per_month=4_000_000_000)


def test_service_retains_validates_downloads_and_deletes_private_source():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"Supplier evidence"
    artifact = artifact_for(content)
    service, repository, object_store = service_for()

    retention = service.retain(
        artifact,
        content,
        workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
        now=now,
    )

    assert retention.status == "retained"
    assert retention.size_bytes == len(content)
    assert retention.expires_at == now + timedelta(hours=24)
    source, downloaded = service.download(
        artifact.workspace_id,
        artifact.artifact_id,
        now=now,
    )
    assert downloaded == content
    assert source.object_key.startswith(
        f"workspaces/{artifact.workspace_id}/artifacts/{artifact.artifact_id}/v1/"
    )
    assert object_store.objects[source.object_key] == content

    assert service.schedule_delete(artifact.workspace_id, artifact.artifact_id)
    assert source.object_key not in object_store.objects
    assert repository.usage(now=now).active_bytes == 0
    with pytest.raises(ArtifactStorageNotFoundError):
        service.download(artifact.workspace_id, artifact.artifact_id, now=now)


def test_service_uses_workspace_expiry_when_it_is_earlier_than_24_hours():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"short workspace"
    artifact = artifact_for(content)
    service, _, _ = service_for()

    retention = service.retain(
        artifact,
        content,
        workspace_expires_at=int((now + timedelta(hours=2)).timestamp()),
        now=now,
    )

    assert retention.expires_at == now + timedelta(hours=2)


def test_expired_objects_are_swept_and_release_active_storage():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"expires"
    artifact = artifact_for(content)
    policy = ArtifactStoragePolicy(retention_hours=1)
    service, repository, object_store = service_for(policy)
    service.retain(
        artifact,
        content,
        workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
        now=now,
    )

    assert service.sweep_expired(now=now + timedelta(hours=1)) == 1
    assert object_store.objects == {}
    assert repository.usage(now=now).active_bytes == 0


def test_repository_blocks_storage_write_read_and_egress_overages_before_provider_calls():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"12345"
    storage_policy = ArtifactStoragePolicy(
        max_active_storage_bytes=5,
        max_workspace_storage_bytes=5,
        max_write_requests_per_month=1,
        max_read_requests_per_month=1,
        max_egress_bytes_per_month=5,
    )
    service, repository, _ = service_for(storage_policy)
    first = artifact_for(content)
    service.retain(
        first,
        content,
        workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
        now=now,
    )

    second = artifact_for(content, workspace_id="demo-other")
    with pytest.raises(ArtifactStorageBudgetExceededError, match="active storage"):
        service.retain(
            second,
            content,
            workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
            now=now,
        )

    assert service.download(first.workspace_id, first.artifact_id, now=now)[1] == content
    with pytest.raises(ArtifactStorageBudgetExceededError, match="read request"):
        service.download(first.workspace_id, first.artifact_id, now=now)
    usage = repository.usage(now=now)
    assert usage.active_bytes == 5
    assert usage.write_requests == 1
    assert usage.read_requests == 1
    assert usage.egress_bytes == 5

    assert service.schedule_delete(first.workspace_id, first.artifact_id)
    with pytest.raises(ArtifactStorageBudgetExceededError, match="write request"):
        service.retain(
            second,
            content,
            workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
            now=now,
        )


def test_egress_is_reserved_before_a_second_download():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"12345"
    policy = ArtifactStoragePolicy(
        max_active_storage_bytes=10,
        max_workspace_storage_bytes=10,
        max_read_requests_per_month=2,
        max_egress_bytes_per_month=5,
    )
    service, repository, _ = service_for(policy)
    artifact = artifact_for(content)
    service.retain(
        artifact,
        content,
        workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
        now=now,
    )

    assert service.download(artifact.workspace_id, artifact.artifact_id, now=now)[1] == content
    with pytest.raises(ArtifactStorageBudgetExceededError, match="egress"):
        service.download(artifact.workspace_id, artifact.artifact_id, now=now)
    usage = repository.usage(now=now)
    assert usage.read_requests == 1
    assert usage.egress_bytes == 5


def test_workspace_storage_limit_is_enforced_before_a_second_upload():
    now = datetime(2026, 8, 9, 12, tzinfo=UTC)
    content = b"12345"
    policy = ArtifactStoragePolicy(
        max_active_storage_bytes=20,
        max_workspace_storage_bytes=5,
    )
    service, repository, object_store = service_for(policy)
    first = artifact_for(content)
    second = artifact_for(content, workspace_id=first.workspace_id)
    service.retain(
        first,
        content,
        workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
        now=now,
    )

    with pytest.raises(ArtifactStorageBudgetExceededError, match="workspace storage"):
        service.retain(
            second,
            content,
            workspace_expires_at=int((now + timedelta(hours=24)).timestamp()),
            now=now,
        )

    assert repository.usage(now=now).active_bytes == len(content)
    assert len(object_store.objects) == 1


class FakeS3Client:
    def __init__(self) -> None:
        self.put_args = None
        self.get_args = None
        self.delete_args = None

    def put_object(self, **kwargs):
        self.put_args = kwargs
        return {"ETag": '"etag"'}

    def get_object(self, **kwargs):
        self.get_args = kwargs
        return {"Body": BytesIO(b"content")}

    def delete_object(self, **kwargs):
        self.delete_args = kwargs


def test_s3_adapter_uses_private_sse_s3_operations_on_one_bucket():
    client = FakeS3Client()
    store = S3ObjectStore(
        bucket="carbonsage-artifacts",
        region="ca-central-1",
        client=client,
    )

    etag = store.put(
        "workspaces/demo/artifacts/id/v1/hash",
        b"content",
        media_type="text/plain",
        content_sha256="a" * 64,
    )
    downloaded = store.get("workspaces/demo/artifacts/id/v1/hash")
    store.delete("workspaces/demo/artifacts/id/v1/hash")

    assert etag == '"etag"'
    assert downloaded == b"content"
    assert client.put_args == {
        "Bucket": "carbonsage-artifacts",
        "Key": "workspaces/demo/artifacts/id/v1/hash",
        "Body": b"content",
        "ContentLength": 7,
        "ContentType": "text/plain",
        "Metadata": {"content-sha256": "a" * 64},
        "ServerSideEncryption": "AES256",
    }
    assert client.get_args == {
        "Bucket": "carbonsage-artifacts",
        "Key": "workspaces/demo/artifacts/id/v1/hash",
    }
    assert client.delete_args == {
        "Bucket": "carbonsage-artifacts",
        "Key": "workspaces/demo/artifacts/id/v1/hash",
    }


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DATABASE_URL is not configured")
def test_postgres_breaker_reservations_are_durable_and_release_active_bytes():
    database_url = os.environ["DATABASE_URL"]
    build_workspace_repository(database_url)  # Applies checked-in migrations.
    repository = PostgresArtifactStorageRepository(database_url)
    now = datetime.now(UTC)
    content = b"postgres storage ledger"
    artifact = artifact_for(content, workspace_id="demo-postgres-storage")
    source = ArtifactObject(
        artifact_id=artifact.artifact_id,
        workspace_id=artifact.workspace_id,
        provider="aws_s3",
        bucket="carbonsage-test",
        object_key=f"workspaces/{artifact.workspace_id}/{artifact.artifact_id}",
        size_bytes=len(content),
        content_sha256=artifact.content_sha256 or "",
        media_type="text/plain",
        status=ArtifactObjectStatus.RESERVED,
        expires_at=now + timedelta(hours=24),
        created_at=now,
    )
    before = repository.usage(now=now)

    repository.reserve_upload(source, ArtifactStoragePolicy(), now=now)
    repository.mark_stored(source.workspace_id, source.artifact_id, '"etag"', now=now)
    reserved_download = repository.reserve_download(
        source.workspace_id,
        source.artifact_id,
        ArtifactStoragePolicy(),
        now=now,
    )
    during = repository.usage(now=now)

    assert reserved_download.content_sha256 == source.content_sha256
    assert during.active_bytes == before.active_bytes + len(content)
    assert during.reserved_bytes == before.reserved_bytes
    assert during.write_requests == before.write_requests + 1
    assert during.read_requests == before.read_requests + 1
    assert during.egress_bytes == before.egress_bytes + len(content)

    repository.mark_deleted(source.workspace_id, source.artifact_id, now=now)
    assert repository.usage(now=now).active_bytes == before.active_bytes
