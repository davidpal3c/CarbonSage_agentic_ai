"""Workspace-scoped artifact catalog and report-snapshot persistence."""

from __future__ import annotations

import threading
from contextlib import closing
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any, Protocol

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:  # pragma: no cover - exercised only before optional local setup
    psycopg = None
    Jsonb = None

from domain.artifacts.models import (
    Artifact,
    ArtifactKind,
    ArtifactSourceType,
    ArtifactStatus,
    ReportSnapshot,
    normalize_artifact_title,
)


class ArtifactNotFoundError(LookupError):
    """Raised when an active artifact is absent from the selected workspace."""


class ArtifactRepository(Protocol):
    def create(self, artifact: Artifact) -> Artifact: ...

    def get(self, workspace_id: str, artifact_id: str) -> Artifact | None: ...

    def list_for_workspace(self, workspace_id: str) -> tuple[Artifact, ...]: ...

    def rename(self, workspace_id: str, artifact_id: str, title: str) -> Artifact: ...

    def mark_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        metadata: dict[str, Any],
    ) -> Artifact: ...

    def mark_failed(self, workspace_id: str, artifact_id: str) -> Artifact: ...

    def soft_delete(self, workspace_id: str, artifact_id: str) -> Artifact: ...

    def soft_delete_other_ready_shipments(
        self,
        workspace_id: str,
        keep_artifact_id: str,
    ) -> int: ...


class ReportSnapshotRepository(Protocol):
    def store(self, snapshot: ReportSnapshot) -> None: ...

    def get(self, workspace_id: str, artifact_id: str) -> ReportSnapshot | None: ...


def _clone_artifact(artifact: Artifact) -> Artifact:
    return replace(artifact, metadata=dict(artifact.metadata))


class InMemoryArtifactRepository:
    """Credential-free artifact catalog used by local development and unit tests."""

    def __init__(self) -> None:
        self._artifacts: dict[tuple[str, str], Artifact] = {}
        self._lock = threading.RLock()

    def create(self, artifact: Artifact) -> Artifact:
        key = (artifact.workspace_id, artifact.artifact_id)
        with self._lock:
            if key in self._artifacts:
                raise ValueError("Artifact already exists.")
            self._artifacts[key] = _clone_artifact(artifact)
        return _clone_artifact(artifact)

    def get(self, workspace_id: str, artifact_id: str) -> Artifact | None:
        with self._lock:
            artifact = self._artifacts.get((workspace_id, artifact_id))
            if artifact is None or artifact.deleted_at is not None:
                return None
            return _clone_artifact(artifact)

    def list_for_workspace(self, workspace_id: str) -> tuple[Artifact, ...]:
        with self._lock:
            artifacts = [
                _clone_artifact(artifact)
                for (record_workspace, _), artifact in self._artifacts.items()
                if record_workspace == workspace_id and artifact.deleted_at is None
            ]
        return tuple(sorted(artifacts, key=lambda artifact: artifact.created_at, reverse=True))

    def _update(self, workspace_id: str, artifact_id: str, **changes: Any) -> Artifact:
        key = (workspace_id, artifact_id)
        with self._lock:
            current = self._artifacts.get(key)
            if current is None or current.deleted_at is not None:
                raise ArtifactNotFoundError(artifact_id)
            updated = replace(current, updated_at=datetime.now(UTC), **changes)
            self._artifacts[key] = updated
            return _clone_artifact(updated)

    def rename(self, workspace_id: str, artifact_id: str, title: str) -> Artifact:
        return self._update(
            workspace_id,
            artifact_id,
            title=normalize_artifact_title(title),
        )

    def mark_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        metadata: dict[str, Any],
    ) -> Artifact:
        return self._update(
            workspace_id,
            artifact_id,
            status=ArtifactStatus.READY,
            metadata=dict(metadata),
        )

    def mark_failed(self, workspace_id: str, artifact_id: str) -> Artifact:
        return self._update(workspace_id, artifact_id, status=ArtifactStatus.FAILED)

    def soft_delete(self, workspace_id: str, artifact_id: str) -> Artifact:
        now = datetime.now(UTC)
        return self._update(workspace_id, artifact_id, deleted_at=now)

    def soft_delete_other_ready_shipments(
        self,
        workspace_id: str,
        keep_artifact_id: str,
    ) -> int:
        deleted = 0
        with self._lock:
            for key, artifact in tuple(self._artifacts.items()):
                if (
                    artifact.workspace_id == workspace_id
                    and artifact.artifact_id != keep_artifact_id
                    and artifact.kind is ArtifactKind.SHIPMENT_DATASET
                    and artifact.deleted_at is None
                ):
                    now = datetime.now(UTC)
                    self._artifacts[key] = replace(artifact, deleted_at=now, updated_at=now)
                    deleted += 1
        return deleted


def _artifact_from_row(row: tuple[Any, ...]) -> Artifact:
    return Artifact(
        artifact_id=str(row[0]),
        workspace_id=row[1],
        kind=ArtifactKind(row[2]),
        title=row[3],
        status=ArtifactStatus(row[4]),
        source_type=ArtifactSourceType(row[5]),
        source_reference=row[6],
        media_type=row[7],
        content_sha256=row[8],
        version=row[9],
        metadata=dict(row[10] or {}),
        created_by=row[11],
        created_at=row[12],
        updated_at=row[13],
        deleted_at=row[14],
    )


ARTIFACT_COLUMNS = """
    artifact_id, workspace_id, kind, title, status, source_type,
    source_reference, media_type, content_sha256, version, metadata,
    created_by, created_at, updated_at, deleted_at
"""


class PostgresArtifactRepository:
    """PostgreSQL artifact catalog with mandatory workspace predicates."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None or Jsonb is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    def create(self, artifact: Artifact) -> Artifact:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    INSERT INTO artifacts ({ARTIFACT_COLUMNS})
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s)
                    RETURNING {ARTIFACT_COLUMNS}
                    """,
                    (
                        artifact.artifact_id,
                        artifact.workspace_id,
                        artifact.kind.value,
                        artifact.title,
                        artifact.status.value,
                        artifact.source_type.value,
                        artifact.source_reference,
                        artifact.media_type,
                        artifact.content_sha256,
                        artifact.version,
                        Jsonb(artifact.metadata),
                        artifact.created_by,
                        artifact.created_at,
                        artifact.updated_at,
                        artifact.deleted_at,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()
        return _artifact_from_row(row)

    def get(self, workspace_id: str, artifact_id: str) -> Artifact | None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {ARTIFACT_COLUMNS}
                    FROM artifacts
                    WHERE workspace_id = %s AND artifact_id = %s AND deleted_at IS NULL
                    """,
                    (workspace_id, artifact_id),
                )
                row = cursor.fetchone()
        return _artifact_from_row(row) if row else None

    def list_for_workspace(self, workspace_id: str) -> tuple[Artifact, ...]:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {ARTIFACT_COLUMNS}
                    FROM artifacts
                    WHERE workspace_id = %s AND deleted_at IS NULL
                    ORDER BY created_at DESC, artifact_id
                    """,
                    (workspace_id,),
                )
                rows = cursor.fetchall()
        return tuple(_artifact_from_row(row) for row in rows)

    def _update(
        self,
        workspace_id: str,
        artifact_id: str,
        assignments: str,
        values: tuple[Any, ...],
    ) -> Artifact:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    UPDATE artifacts
                    SET {assignments}, updated_at = CURRENT_TIMESTAMP
                    WHERE workspace_id = %s AND artifact_id = %s AND deleted_at IS NULL
                    RETURNING {ARTIFACT_COLUMNS}
                    """,
                    (*values, workspace_id, artifact_id),
                )
                row = cursor.fetchone()
                if row is None:
                    connection.rollback()
                    raise ArtifactNotFoundError(artifact_id)
            connection.commit()
        return _artifact_from_row(row)

    def rename(self, workspace_id: str, artifact_id: str, title: str) -> Artifact:
        return self._update(
            workspace_id,
            artifact_id,
            "title = %s",
            (normalize_artifact_title(title),),
        )

    def mark_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        metadata: dict[str, Any],
    ) -> Artifact:
        return self._update(
            workspace_id,
            artifact_id,
            "status = 'ready', metadata = %s",
            (Jsonb(metadata),),
        )

    def mark_failed(self, workspace_id: str, artifact_id: str) -> Artifact:
        return self._update(workspace_id, artifact_id, "status = 'failed'", ())

    def soft_delete(self, workspace_id: str, artifact_id: str) -> Artifact:
        return self._update(
            workspace_id,
            artifact_id,
            "deleted_at = CURRENT_TIMESTAMP",
            (),
        )

    def soft_delete_other_ready_shipments(
        self,
        workspace_id: str,
        keep_artifact_id: str,
    ) -> int:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE artifacts
                    SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE workspace_id = %s
                      AND kind = 'shipment_dataset'
                      AND artifact_id <> %s
                      AND deleted_at IS NULL
                    """,
                    (workspace_id, keep_artifact_id),
                )
                deleted = cursor.rowcount
            connection.commit()
        return deleted


class InMemoryReportSnapshotRepository:
    def __init__(self) -> None:
        self._snapshots: dict[tuple[str, str], ReportSnapshot] = {}
        self._lock = threading.RLock()

    def store(self, snapshot: ReportSnapshot) -> None:
        with self._lock:
            self._snapshots[(snapshot.workspace_id, snapshot.artifact_id)] = replace(
                snapshot,
                payload=dict(snapshot.payload),
            )

    def get(self, workspace_id: str, artifact_id: str) -> ReportSnapshot | None:
        with self._lock:
            snapshot = self._snapshots.get((workspace_id, artifact_id))
            return replace(snapshot, payload=dict(snapshot.payload)) if snapshot else None


class PostgresReportSnapshotRepository:
    def __init__(self, database_url: str) -> None:
        if psycopg is None or Jsonb is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    def store(self, snapshot: ReportSnapshot) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO report_snapshots
                        (artifact_id, workspace_id, schema_version, payload, generated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        snapshot.artifact_id,
                        snapshot.workspace_id,
                        snapshot.schema_version,
                        Jsonb(snapshot.payload),
                        snapshot.generated_at,
                    ),
                )
            connection.commit()

    def get(self, workspace_id: str, artifact_id: str) -> ReportSnapshot | None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT artifact_id, workspace_id, schema_version, payload, generated_at
                    FROM report_snapshots
                    WHERE workspace_id = %s AND artifact_id = %s
                    """,
                    (workspace_id, artifact_id),
                )
                row = cursor.fetchone()
        if row is None:
            return None
        return ReportSnapshot(
            artifact_id=str(row[0]),
            workspace_id=row[1],
            schema_version=row[2],
            payload=dict(row[3]),
            generated_at=row[4],
        )


def build_artifact_repository(database_url: str | None) -> ArtifactRepository:
    if database_url:
        return PostgresArtifactRepository(database_url)
    return InMemoryArtifactRepository()


def build_report_snapshot_repository(database_url: str | None) -> ReportSnapshotRepository:
    if database_url:
        return PostgresReportSnapshotRepository(database_url)
    return InMemoryReportSnapshotRepository()
