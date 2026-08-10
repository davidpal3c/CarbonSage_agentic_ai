"""Application service for bounded 24-hour artifact source retention."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from hashlib import sha256

from domain.artifacts.models import Artifact
from domain.artifacts.storage import (
    ArtifactObject,
    ArtifactObjectStatus,
    ArtifactStorageNotFoundError,
    ArtifactStoragePolicy,
    ArtifactStorageProviderError,
    ArtifactStorageUsage,
    SourceRetention,
)
from integrations.aws_s3 import ObjectStore
from persistence.artifact_storage import ArtifactStorageRepository


class ArtifactStorageService:
    """Coordinates durable budget reservations with S3 operations."""

    def __init__(
        self,
        *,
        enabled: bool,
        repository: ArtifactStorageRepository,
        policy: ArtifactStoragePolicy,
        object_store: ObjectStore | None = None,
        bucket: str = "",
        provider: str = "aws_s3",
    ) -> None:
        if enabled and object_store is None:
            raise ValueError("An object store is required when artifact storage is enabled.")
        if enabled and not bucket:
            raise ValueError("A bucket is required when artifact storage is enabled.")
        self.enabled = enabled
        self.repository = repository
        self.policy = policy
        self.object_store = object_store
        self.bucket = bucket
        self.provider = provider

    def retain(
        self,
        artifact: Artifact,
        content: bytes,
        *,
        workspace_expires_at: int,
        now: datetime | None = None,
    ) -> SourceRetention:
        if not self.enabled:
            return SourceRetention(status="ephemeral")
        if not content:
            raise ValueError("Empty artifact sources cannot be retained.")

        timestamp = now or datetime.now(UTC)
        retention_expiry = timestamp + timedelta(hours=self.policy.retention_hours)
        workspace_expiry = datetime.fromtimestamp(workspace_expires_at, UTC)
        expires_at = min(retention_expiry, workspace_expiry)
        if expires_at <= timestamp:
            raise ArtifactStorageNotFoundError(artifact.artifact_id)

        self.sweep_expired(now=timestamp)
        digest = sha256(content).hexdigest()
        if artifact.content_sha256 != digest:
            raise ValueError("Artifact source hash does not match its catalog record.")
        object_key = (
            f"workspaces/{artifact.workspace_id}/artifacts/{artifact.artifact_id}/"
            f"v{artifact.version}/{digest}"
        )
        source = ArtifactObject(
            artifact_id=artifact.artifact_id,
            workspace_id=artifact.workspace_id,
            provider=self.provider,
            bucket=self.bucket,
            object_key=object_key,
            size_bytes=len(content),
            content_sha256=digest,
            media_type=artifact.media_type or "application/octet-stream",
            status=ArtifactObjectStatus.RESERVED,
            expires_at=expires_at,
            created_at=timestamp,
        )
        self.repository.reserve_upload(source, self.policy, now=timestamp)
        try:
            etag = self.object_store.put(
                object_key,
                content,
                media_type=source.media_type,
                content_sha256=digest,
            )
            stored = self.repository.mark_stored(
                artifact.workspace_id,
                artifact.artifact_id,
                etag,
                now=timestamp,
            )
        except Exception:
            try:
                self.object_store.delete(object_key)
            except ArtifactStorageProviderError:
                pass
            self.repository.mark_upload_failed(
                artifact.workspace_id,
                artifact.artifact_id,
                now=timestamp,
            )
            raise
        return SourceRetention(
            status="retained",
            size_bytes=stored.size_bytes,
            expires_at=stored.expires_at,
        )

    def download(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> tuple[ArtifactObject, bytes]:
        if not self.enabled:
            raise ArtifactStorageNotFoundError(artifact_id)
        timestamp = now or datetime.now(UTC)
        source = self.repository.reserve_download(
            workspace_id,
            artifact_id,
            self.policy,
            now=timestamp,
        )
        content = self.object_store.get(source.object_key)
        if (
            len(content) != source.size_bytes
            or sha256(content).hexdigest() != source.content_sha256
        ):
            raise ArtifactStorageProviderError(
                "Stored artifact source failed integrity validation."
            )
        return source, content

    def schedule_delete(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> bool:
        if not self.enabled:
            return True
        timestamp = now or datetime.now(UTC)
        self.sweep_expired(now=timestamp)
        source = self.repository.get_ready(workspace_id, artifact_id, now=timestamp)
        if source is None:
            return True
        self.repository.mark_delete_pending(workspace_id, artifact_id)
        try:
            self.object_store.delete(source.object_key)
        except ArtifactStorageProviderError:
            return False
        self.repository.mark_deleted(workspace_id, artifact_id, now=timestamp)
        return True

    def sweep_expired(
        self,
        *,
        now: datetime | None = None,
        limit: int = 100,
    ) -> int:
        if not self.enabled:
            return 0
        timestamp = now or datetime.now(UTC)
        deleted = 0
        for source in self.repository.cleanup_candidates(now=timestamp, limit=limit):
            try:
                self.object_store.delete(source.object_key)
            except ArtifactStorageProviderError:
                self.repository.mark_delete_pending(source.workspace_id, source.artifact_id)
                continue
            self.repository.mark_deleted(
                source.workspace_id,
                source.artifact_id,
                now=timestamp,
            )
            deleted += 1
        return deleted

    def usage(self, *, now: datetime | None = None) -> ArtifactStorageUsage:
        return self.repository.usage(now=now)
