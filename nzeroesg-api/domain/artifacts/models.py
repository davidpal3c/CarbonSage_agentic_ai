"""Framework-independent workspace artifact records."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4


class ArtifactKind(StrEnum):
    SHIPMENT_DATASET = "shipment_dataset"
    EVIDENCE_DOCUMENT = "evidence_document"
    REPORT_SNAPSHOT = "report_snapshot"


class ArtifactStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ArtifactSourceType(StrEnum):
    LOCAL_UPLOAD = "local_upload"
    GENERATED = "generated"
    GOOGLE_DRIVE = "google_drive"
    LEGACY_MIGRATION = "legacy_migration"


def normalize_artifact_title(value: str) -> str:
    title = " ".join(value.strip().split())
    if not title:
        raise ValueError("Artifact title is required.")
    if len(title) > 255:
        raise ValueError("Artifact title must contain at most 255 characters.")
    return title


@dataclass(frozen=True)
class Artifact:
    artifact_id: str
    workspace_id: str
    kind: ArtifactKind
    title: str
    status: ArtifactStatus
    source_type: ArtifactSourceType
    source_reference: str | None
    media_type: str | None
    content_sha256: str | None
    version: int
    metadata: dict[str, Any] = field(default_factory=dict)
    created_by: str = "demo-session"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    deleted_at: datetime | None = None

    def __post_init__(self) -> None:
        normalize_artifact_title(self.title)
        if self.version < 1:
            raise ValueError("Artifact version must be positive.")
        if self.content_sha256 is not None and len(self.content_sha256) != 64:
            raise ValueError("Artifact content hash must be a SHA-256 digest.")

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifact_id": self.artifact_id,
            "workspace_id": self.workspace_id,
            "kind": self.kind.value,
            "title": self.title,
            "status": self.status.value,
            "source_type": self.source_type.value,
            "source_reference": self.source_reference,
            "media_type": self.media_type,
            "content_sha256": self.content_sha256,
            "version": self.version,
            "metadata": dict(self.metadata),
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
        }


def create_artifact(
    *,
    workspace_id: str,
    kind: ArtifactKind,
    title: str,
    source_type: ArtifactSourceType,
    created_by: str,
    source_reference: str | None = None,
    media_type: str | None = None,
    content_sha256: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Artifact:
    now = datetime.now(UTC)
    return Artifact(
        artifact_id=str(uuid4()),
        workspace_id=workspace_id,
        kind=kind,
        title=normalize_artifact_title(title),
        status=ArtifactStatus.PROCESSING,
        source_type=source_type,
        source_reference=source_reference,
        media_type=media_type,
        content_sha256=content_sha256,
        version=1,
        metadata=dict(metadata or {}),
        created_by=created_by,
        created_at=now,
        updated_at=now,
    )


@dataclass(frozen=True)
class ReportSnapshot:
    artifact_id: str
    workspace_id: str
    schema_version: str
    payload: dict[str, Any]
    generated_at: datetime
