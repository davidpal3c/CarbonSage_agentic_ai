"""Durable source-object metadata and application-side S3 cost breakers."""

from __future__ import annotations

import threading
from contextlib import closing
from dataclasses import replace
from datetime import UTC, date, datetime
from typing import Any, Protocol

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised only before optional local setup
    psycopg = None

from domain.artifacts.storage import (
    ArtifactObject,
    ArtifactObjectStatus,
    ArtifactStorageBudgetExceededError,
    ArtifactStorageNotFoundError,
    ArtifactStoragePolicy,
    ArtifactStorageUsage,
)


def _period_start(now: datetime) -> date:
    return date(now.year, now.month, 1)


def _clone(value: ArtifactObject) -> ArtifactObject:
    return replace(value)


class ArtifactStorageRepository(Protocol):
    def reserve_upload(
        self,
        source: ArtifactObject,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject: ...

    def mark_stored(
        self,
        workspace_id: str,
        artifact_id: str,
        etag: str | None,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject: ...

    def mark_upload_failed(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None: ...

    def get_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject | None: ...

    def reserve_download(
        self,
        workspace_id: str,
        artifact_id: str,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject: ...

    def mark_delete_pending(self, workspace_id: str, artifact_id: str) -> None: ...

    def mark_deleted(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None: ...

    def cleanup_candidates(
        self,
        *,
        now: datetime | None = None,
        limit: int = 100,
    ) -> tuple[ArtifactObject, ...]: ...

    def usage(self, *, now: datetime | None = None) -> ArtifactStorageUsage: ...


class InMemoryArtifactStorageRepository:
    """Thread-safe breaker ledger for unit tests and credential-free development."""

    def __init__(self) -> None:
        self._objects: dict[tuple[str, str], ArtifactObject] = {}
        self._active_bytes = 0
        self._reserved_bytes = 0
        self._monthly: dict[date, dict[str, int]] = {}
        self._lock = threading.RLock()

    def _month(self, now: datetime) -> dict[str, int]:
        return self._monthly.setdefault(
            _period_start(now),
            {"write_requests": 0, "read_requests": 0, "egress_bytes": 0},
        )

    def reserve_upload(
        self,
        source: ArtifactObject,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        key = (source.workspace_id, source.artifact_id)
        with self._lock:
            if key in self._objects:
                raise ValueError("Artifact source already has a storage record.")
            workspace_bytes = sum(
                item.size_bytes
                for item in self._objects.values()
                if item.workspace_id == source.workspace_id
                and item.status
                in {
                    ArtifactObjectStatus.RESERVED,
                    ArtifactObjectStatus.READY,
                    ArtifactObjectStatus.DELETE_PENDING,
                }
            )
            if workspace_bytes + source.size_bytes > policy.max_workspace_storage_bytes:
                raise ArtifactStorageBudgetExceededError("workspace storage")
            if (
                self._active_bytes + self._reserved_bytes + source.size_bytes
                > policy.max_active_storage_bytes
            ):
                raise ArtifactStorageBudgetExceededError("active storage")
            monthly = self._month(timestamp)
            if monthly["write_requests"] + 1 > policy.max_write_requests_per_month:
                raise ArtifactStorageBudgetExceededError("monthly write request")
            monthly["write_requests"] += 1
            self._reserved_bytes += source.size_bytes
            reserved = replace(
                source,
                status=ArtifactObjectStatus.RESERVED,
                created_at=timestamp,
            )
            self._objects[key] = reserved
            return _clone(reserved)

    def mark_stored(
        self,
        workspace_id: str,
        artifact_id: str,
        etag: str | None,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        key = (workspace_id, artifact_id)
        with self._lock:
            current = self._objects.get(key)
            if current is None or current.status is not ArtifactObjectStatus.RESERVED:
                raise ArtifactStorageNotFoundError(artifact_id)
            self._reserved_bytes -= current.size_bytes
            self._active_bytes += current.size_bytes
            stored = replace(
                current,
                status=ArtifactObjectStatus.READY,
                etag=etag,
                stored_at=timestamp,
            )
            self._objects[key] = stored
            return _clone(stored)

    def mark_upload_failed(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None:
        key = (workspace_id, artifact_id)
        with self._lock:
            current = self._objects.get(key)
            if current is None:
                return
            if current.status is ArtifactObjectStatus.RESERVED:
                self._reserved_bytes -= current.size_bytes
            self._objects[key] = replace(current, status=ArtifactObjectStatus.FAILED)

    def get_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject | None:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            current = self._objects.get((workspace_id, artifact_id))
            if (
                current is None
                or current.status is not ArtifactObjectStatus.READY
                or current.expires_at <= timestamp
            ):
                return None
            return _clone(current)

    def reserve_download(
        self,
        workspace_id: str,
        artifact_id: str,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            source = self.get_ready(workspace_id, artifact_id, now=timestamp)
            if source is None:
                raise ArtifactStorageNotFoundError(artifact_id)
            monthly = self._month(timestamp)
            if monthly["read_requests"] + 1 > policy.max_read_requests_per_month:
                raise ArtifactStorageBudgetExceededError("monthly read request")
            if monthly["egress_bytes"] + source.size_bytes > policy.max_egress_bytes_per_month:
                raise ArtifactStorageBudgetExceededError("monthly egress")
            monthly["read_requests"] += 1
            monthly["egress_bytes"] += source.size_bytes
            return source

    def mark_delete_pending(self, workspace_id: str, artifact_id: str) -> None:
        key = (workspace_id, artifact_id)
        with self._lock:
            current = self._objects.get(key)
            if current and current.status is ArtifactObjectStatus.READY:
                self._objects[key] = replace(
                    current,
                    status=ArtifactObjectStatus.DELETE_PENDING,
                )

    def mark_deleted(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None:
        timestamp = now or datetime.now(UTC)
        key = (workspace_id, artifact_id)
        with self._lock:
            current = self._objects.get(key)
            if current is None or current.status is ArtifactObjectStatus.DELETED:
                return
            if current.status is ArtifactObjectStatus.RESERVED:
                self._reserved_bytes -= current.size_bytes
            elif current.status in {
                ArtifactObjectStatus.READY,
                ArtifactObjectStatus.DELETE_PENDING,
            }:
                self._active_bytes -= current.size_bytes
            self._objects[key] = replace(
                current,
                status=ArtifactObjectStatus.DELETED,
                deleted_at=timestamp,
            )

    def cleanup_candidates(
        self,
        *,
        now: datetime | None = None,
        limit: int = 100,
    ) -> tuple[ArtifactObject, ...]:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            candidates = [
                _clone(item)
                for item in self._objects.values()
                if item.status is ArtifactObjectStatus.DELETE_PENDING
                or (item.status is ArtifactObjectStatus.READY and item.expires_at <= timestamp)
            ]
        candidates.sort(key=lambda item: (item.expires_at, item.artifact_id))
        return tuple(candidates[:limit])

    def usage(self, *, now: datetime | None = None) -> ArtifactStorageUsage:
        timestamp = now or datetime.now(UTC)
        with self._lock:
            monthly = dict(self._month(timestamp))
            return ArtifactStorageUsage(
                period_start=_period_start(timestamp),
                active_bytes=self._active_bytes,
                reserved_bytes=self._reserved_bytes,
                write_requests=monthly["write_requests"],
                read_requests=monthly["read_requests"],
                egress_bytes=monthly["egress_bytes"],
            )


def _object_from_row(row: tuple[Any, ...]) -> ArtifactObject:
    return ArtifactObject(
        artifact_id=str(row[0]),
        workspace_id=row[1],
        provider=row[2],
        bucket=row[3],
        object_key=row[4],
        size_bytes=row[5],
        content_sha256=row[6],
        media_type=row[7],
        status=ArtifactObjectStatus(row[8]),
        expires_at=row[9],
        etag=row[10],
        created_at=row[11],
        stored_at=row[12],
        deleted_at=row[13],
    )


OBJECT_COLUMNS = """
    artifact_id, workspace_id, provider, bucket, object_key, size_bytes,
    content_sha256, media_type, status, expires_at, etag, created_at,
    stored_at, deleted_at
"""


class PostgresArtifactStorageRepository:
    """Transactional global and monthly breakers shared by all API instances."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required for durable artifact storage budgets.")
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url)

    @staticmethod
    def _lock_state(cursor) -> tuple[int, int]:
        cursor.execute(
            """
            SELECT active_bytes, reserved_bytes
            FROM artifact_storage_state
            WHERE singleton = TRUE
            FOR UPDATE
            """
        )
        row = cursor.fetchone()
        if row is None:  # pragma: no cover - migration invariant
            raise RuntimeError("Artifact storage state is missing.")
        return row[0], row[1]

    @staticmethod
    def _lock_month(cursor, period: date) -> tuple[int, int, int]:
        cursor.execute(
            """
            INSERT INTO artifact_storage_monthly_usage (period_start)
            VALUES (%s)
            ON CONFLICT (period_start) DO NOTHING
            """,
            (period,),
        )
        cursor.execute(
            """
            SELECT write_requests, read_requests, egress_bytes
            FROM artifact_storage_monthly_usage
            WHERE period_start = %s
            FOR UPDATE
            """,
            (period,),
        )
        return cursor.fetchone()

    def reserve_upload(
        self,
        source: ArtifactObject,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        period = _period_start(timestamp)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                active_bytes, reserved_bytes = self._lock_state(cursor)
                write_requests, _, _ = self._lock_month(cursor, period)
                cursor.execute(
                    """
                    SELECT COALESCE(SUM(size_bytes), 0)
                    FROM artifact_objects
                    WHERE workspace_id = %s
                      AND status IN ('reserved', 'ready', 'delete_pending')
                    """,
                    (source.workspace_id,),
                )
                workspace_bytes = cursor.fetchone()[0]
                if workspace_bytes + source.size_bytes > policy.max_workspace_storage_bytes:
                    connection.rollback()
                    raise ArtifactStorageBudgetExceededError("workspace storage")
                if (
                    active_bytes + reserved_bytes + source.size_bytes
                    > policy.max_active_storage_bytes
                ):
                    connection.rollback()
                    raise ArtifactStorageBudgetExceededError("active storage")
                if write_requests + 1 > policy.max_write_requests_per_month:
                    connection.rollback()
                    raise ArtifactStorageBudgetExceededError("monthly write request")
                cursor.execute(
                    f"""
                    INSERT INTO artifact_objects ({OBJECT_COLUMNS})
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'reserved',
                            %s, NULL, %s, NULL, NULL)
                    RETURNING {OBJECT_COLUMNS}
                    """,
                    (
                        source.artifact_id,
                        source.workspace_id,
                        source.provider,
                        source.bucket,
                        source.object_key,
                        source.size_bytes,
                        source.content_sha256,
                        source.media_type,
                        source.expires_at,
                        timestamp,
                    ),
                )
                row = cursor.fetchone()
                cursor.execute(
                    """
                    UPDATE artifact_storage_state
                    SET reserved_bytes = reserved_bytes + %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE singleton = TRUE
                    """,
                    (source.size_bytes,),
                )
                cursor.execute(
                    """
                    UPDATE artifact_storage_monthly_usage
                    SET write_requests = write_requests + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE period_start = %s
                    """,
                    (period,),
                )
            connection.commit()
        return _object_from_row(row)

    def mark_stored(
        self,
        workspace_id: str,
        artifact_id: str,
        etag: str | None,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                self._lock_state(cursor)
                cursor.execute(
                    """
                    SELECT size_bytes
                    FROM artifact_objects
                    WHERE workspace_id = %s AND artifact_id = %s AND status = 'reserved'
                    FOR UPDATE
                    """,
                    (workspace_id, artifact_id),
                )
                current = cursor.fetchone()
                if current is None:
                    connection.rollback()
                    raise ArtifactStorageNotFoundError(artifact_id)
                size_bytes = current[0]
                cursor.execute(
                    f"""
                    UPDATE artifact_objects
                    SET status = 'ready', etag = %s, stored_at = %s
                    WHERE workspace_id = %s AND artifact_id = %s
                    RETURNING {OBJECT_COLUMNS}
                    """,
                    (etag, timestamp, workspace_id, artifact_id),
                )
                row = cursor.fetchone()
                cursor.execute(
                    """
                    UPDATE artifact_storage_state
                    SET reserved_bytes = reserved_bytes - %s,
                        active_bytes = active_bytes + %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE singleton = TRUE
                    """,
                    (size_bytes, size_bytes),
                )
            connection.commit()
        return _object_from_row(row)

    def mark_upload_failed(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                self._lock_state(cursor)
                cursor.execute(
                    """
                    SELECT size_bytes
                    FROM artifact_objects
                    WHERE workspace_id = %s AND artifact_id = %s AND status = 'reserved'
                    FOR UPDATE
                    """,
                    (workspace_id, artifact_id),
                )
                current = cursor.fetchone()
                if current is None:
                    connection.rollback()
                    return
                cursor.execute(
                    """
                    UPDATE artifact_objects SET status = 'failed'
                    WHERE workspace_id = %s AND artifact_id = %s
                    """,
                    (workspace_id, artifact_id),
                )
                cursor.execute(
                    """
                    UPDATE artifact_storage_state
                    SET reserved_bytes = reserved_bytes - %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE singleton = TRUE
                    """,
                    (current[0],),
                )
            connection.commit()

    def get_ready(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject | None:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {OBJECT_COLUMNS}
                    FROM artifact_objects
                    WHERE workspace_id = %s AND artifact_id = %s
                      AND status = 'ready' AND expires_at > %s
                    """,
                    (workspace_id, artifact_id, timestamp),
                )
                row = cursor.fetchone()
        return _object_from_row(row) if row else None

    def reserve_download(
        self,
        workspace_id: str,
        artifact_id: str,
        policy: ArtifactStoragePolicy,
        *,
        now: datetime | None = None,
    ) -> ArtifactObject:
        timestamp = now or datetime.now(UTC)
        period = _period_start(timestamp)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                _, read_requests, egress_bytes = self._lock_month(cursor, period)
                cursor.execute(
                    f"""
                    SELECT {OBJECT_COLUMNS}
                    FROM artifact_objects
                    WHERE workspace_id = %s AND artifact_id = %s
                      AND status = 'ready' AND expires_at > %s
                    FOR UPDATE
                    """,
                    (workspace_id, artifact_id, timestamp),
                )
                row = cursor.fetchone()
                if row is None:
                    connection.rollback()
                    raise ArtifactStorageNotFoundError(artifact_id)
                source = _object_from_row(row)
                if read_requests + 1 > policy.max_read_requests_per_month:
                    connection.rollback()
                    raise ArtifactStorageBudgetExceededError("monthly read request")
                if egress_bytes + source.size_bytes > policy.max_egress_bytes_per_month:
                    connection.rollback()
                    raise ArtifactStorageBudgetExceededError("monthly egress")
                cursor.execute(
                    """
                    UPDATE artifact_storage_monthly_usage
                    SET read_requests = read_requests + 1,
                        egress_bytes = egress_bytes + %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE period_start = %s
                    """,
                    (source.size_bytes, period),
                )
            connection.commit()
        return source

    def mark_delete_pending(self, workspace_id: str, artifact_id: str) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE artifact_objects SET status = 'delete_pending'
                    WHERE workspace_id = %s AND artifact_id = %s AND status = 'ready'
                    """,
                    (workspace_id, artifact_id),
                )
            connection.commit()

    def mark_deleted(
        self,
        workspace_id: str,
        artifact_id: str,
        *,
        now: datetime | None = None,
    ) -> None:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                self._lock_state(cursor)
                cursor.execute(
                    """
                    SELECT size_bytes, status
                    FROM artifact_objects
                    WHERE workspace_id = %s AND artifact_id = %s
                    FOR UPDATE
                    """,
                    (workspace_id, artifact_id),
                )
                current = cursor.fetchone()
                if current is None or current[1] == ArtifactObjectStatus.DELETED.value:
                    connection.rollback()
                    return
                size_bytes, object_status = current
                cursor.execute(
                    """
                    UPDATE artifact_objects
                    SET status = 'deleted', deleted_at = %s
                    WHERE workspace_id = %s AND artifact_id = %s
                    """,
                    (timestamp, workspace_id, artifact_id),
                )
                if object_status == ArtifactObjectStatus.RESERVED.value:
                    cursor.execute(
                        """
                        UPDATE artifact_storage_state
                        SET reserved_bytes = reserved_bytes - %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE singleton = TRUE
                        """,
                        (size_bytes,),
                    )
                elif object_status in {
                    ArtifactObjectStatus.READY.value,
                    ArtifactObjectStatus.DELETE_PENDING.value,
                }:
                    cursor.execute(
                        """
                        UPDATE artifact_storage_state
                        SET active_bytes = active_bytes - %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE singleton = TRUE
                        """,
                        (size_bytes,),
                    )
            connection.commit()

    def cleanup_candidates(
        self,
        *,
        now: datetime | None = None,
        limit: int = 100,
    ) -> tuple[ArtifactObject, ...]:
        timestamp = now or datetime.now(UTC)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT {OBJECT_COLUMNS}
                    FROM artifact_objects
                    WHERE status = 'delete_pending'
                       OR (status = 'ready' AND expires_at <= %s)
                    ORDER BY expires_at, artifact_id
                    LIMIT %s
                    """,
                    (timestamp, limit),
                )
                rows = cursor.fetchall()
        return tuple(_object_from_row(row) for row in rows)

    def usage(self, *, now: datetime | None = None) -> ArtifactStorageUsage:
        timestamp = now or datetime.now(UTC)
        period = _period_start(timestamp)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                active_bytes, reserved_bytes = self._lock_state(cursor)
                writes, reads, egress = self._lock_month(cursor, period)
            connection.commit()
        return ArtifactStorageUsage(
            period_start=period,
            active_bytes=active_bytes,
            reserved_bytes=reserved_bytes,
            write_requests=writes,
            read_requests=reads,
            egress_bytes=egress,
        )


def build_artifact_storage_repository(database_url: str | None) -> ArtifactStorageRepository:
    if database_url:
        return PostgresArtifactStorageRepository(database_url)
    return InMemoryArtifactStorageRepository()
