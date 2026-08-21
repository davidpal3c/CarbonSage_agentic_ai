"""Workspace repository implementations.

The PostgreSQL adapter is the deployment path. The in-memory adapter exists
only for credential-free local development and tests that do not configure a
database; it is never selected when ``DATABASE_URL`` is present.
"""

from __future__ import annotations

import threading
from contextlib import closing
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Protocol

try:
    import psycopg
except ImportError:  # pragma: no cover - exercised only before optional local setup
    psycopg = None

from domain.workspaces.sessions import (
    ASSISTANT_REQUESTS_PER_DAY,
    QuotaRecord,
    WorkspaceSession,
)

QUOTA_DEFAULTS = {
    "evidence_documents": 3,
    "analysis_runs_per_day": 10,
    "assistant_requests_per_day": ASSISTANT_REQUESTS_PER_DAY,
}
DAILY_QUOTAS = {"analysis_runs_per_day", "assistant_requests_per_day"}
MIGRATIONS_DIR = Path(__file__).parent / "migrations"


class WorkspaceNotFoundError(LookupError):
    """Raised when a workspace record is missing, expired, or revoked."""


class QuotaExceededError(RuntimeError):
    """Raised when a workspace has exhausted a server-side quota."""


class WorkspaceRepository(Protocol):
    def create(self, session: WorkspaceSession) -> None: ...

    def get(self, workspace_id: str, *, now: int | None = None) -> WorkspaceSession | None: ...

    def revoke(self, workspace_id: str) -> None: ...

    def purge_expired(self, *, now: int | None = None) -> int: ...

    def consume_quota(self, workspace_id: str, quota_key: str) -> QuotaRecord: ...


def _now_timestamp(now: int | None = None) -> int:
    return int(datetime.now(UTC).timestamp()) if now is None else now


def _utc_datetime(timestamp: int) -> datetime:
    return datetime.fromtimestamp(timestamp, UTC)


def _date_for_timestamp(timestamp: int) -> date:
    return _utc_datetime(timestamp).date()


def _clone(session: WorkspaceSession) -> WorkspaceSession:
    return WorkspaceSession.from_payload(session.to_payload())


def _session_from_quota_rows(
    *,
    workspace_id: str,
    issued_at: int,
    expires_at: int,
    retention_policy: str,
    quota_rows: list[tuple[str, int, int]],
) -> WorkspaceSession:
    return WorkspaceSession.from_payload(
        {
            "version": 1,
            "workspace_id": workspace_id,
            "issued_at": issued_at,
            "expires_at": expires_at,
            "quotas": {
                quota_key: {"used": used, "limit": quota_limit}
                for quota_key, used, quota_limit in quota_rows
            },
            "retention": {"expires_at": expires_at, "policy": retention_policy},
        }
    )


class InMemoryWorkspaceRepository:
    """Non-persistent adapter used only when local development has no database."""

    def __init__(self) -> None:
        self._sessions: dict[str, WorkspaceSession] = {}
        self._period_starts: dict[tuple[str, str], date] = {}
        self._lock = threading.RLock()

    def create(self, session: WorkspaceSession) -> None:
        with self._lock:
            if session.workspace_id in self._sessions:
                raise ValueError("Workspace already exists.")
            self._sessions[session.workspace_id] = _clone(session)
            start = _date_for_timestamp(session.issued_at)
            for quota_key in session.quotas:
                self._period_starts[(session.workspace_id, quota_key)] = start

    def get(self, workspace_id: str, *, now: int | None = None) -> WorkspaceSession | None:
        timestamp = _now_timestamp(now)
        today = _date_for_timestamp(timestamp)
        with self._lock:
            session = self._sessions.get(workspace_id)
            if session is None or session.is_expired(now=timestamp):
                return None
            quotas = dict(session.quotas)
            changed = False
            for quota_key in DAILY_QUOTAS:
                period_key = (workspace_id, quota_key)
                if self._period_starts[period_key] < today:
                    quotas[quota_key] = QuotaRecord(
                        used=0,
                        limit=quotas[quota_key].limit,
                    )
                    self._period_starts[period_key] = today
                    changed = True
            if changed:
                session = WorkspaceSession(
                    workspace_id=session.workspace_id,
                    issued_at=session.issued_at,
                    expires_at=session.expires_at,
                    quotas=quotas,
                    retention=session.retention,
                )
                self._sessions[workspace_id] = session
            return _clone(session)

    def revoke(self, workspace_id: str) -> None:
        with self._lock:
            self._sessions.pop(workspace_id, None)

    def purge_expired(self, *, now: int | None = None) -> int:
        timestamp = _now_timestamp(now)
        with self._lock:
            expired = [
                workspace_id
                for workspace_id, session in self._sessions.items()
                if session.is_expired(now=timestamp)
            ]
            for workspace_id in expired:
                self._sessions.pop(workspace_id, None)
            return len(expired)

    def consume_quota(self, workspace_id: str, quota_key: str) -> QuotaRecord:
        if quota_key not in QUOTA_DEFAULTS:
            raise ValueError(f"Unknown workspace quota: {quota_key}")
        timestamp = _now_timestamp()
        today = _date_for_timestamp(timestamp)
        with self._lock:
            session = self._sessions.get(workspace_id)
            if session is None or session.is_expired(now=timestamp):
                raise WorkspaceNotFoundError(workspace_id)
            quota = session.quotas[quota_key]
            period_key = (workspace_id, quota_key)
            if quota_key in DAILY_QUOTAS and self._period_starts[period_key] < today:
                quota = QuotaRecord(used=0, limit=quota.limit)
                self._period_starts[period_key] = today
            if quota.used >= quota.limit:
                raise QuotaExceededError(quota_key)
            updated = QuotaRecord(used=quota.used + 1, limit=quota.limit)
            quotas = dict(session.quotas)
            quotas[quota_key] = updated
            self._sessions[workspace_id] = WorkspaceSession(
                workspace_id=session.workspace_id,
                issued_at=session.issued_at,
                expires_at=session.expires_at,
                quotas=quotas,
                retention=session.retention,
            )
            return updated


class PostgresWorkspaceRepository:
    """PostgreSQL implementation with transactional quota increments."""

    def __init__(self, database_url: str) -> None:
        if psycopg is None:
            raise RuntimeError("psycopg is required when DATABASE_URL is configured.")
        self.database_url = database_url
        self.migrate()

    def _connect(self):
        return psycopg.connect(self.database_url)

    def migrate(self) -> None:
        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version VARCHAR(120) PRIMARY KEY,
                        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
                for migration_file in migration_files:
                    version = migration_file.stem
                    cursor.execute(
                        "SELECT 1 FROM schema_migrations WHERE version = %s",
                        (version,),
                    )
                    if cursor.fetchone() is not None:
                        continue
                    statements = migration_file.read_text(encoding="utf-8").split(";")
                    for statement in statements:
                        if statement.strip():
                            cursor.execute(statement)
                    cursor.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (version,),
                    )
            connection.commit()

    def create(self, session: WorkspaceSession) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO workspaces (workspace_id, issued_at, expires_at)
                    VALUES (%s, %s, %s)
                    """,
                    (
                        session.workspace_id,
                        _utc_datetime(session.issued_at),
                        _utc_datetime(session.expires_at),
                    ),
                )
                cursor.execute(
                    """
                    INSERT INTO workspace_retention (workspace_id, expires_at, policy)
                    VALUES (%s, %s, %s)
                    """,
                    (
                        session.workspace_id,
                        _utc_datetime(session.retention.expires_at),
                        session.retention.policy,
                    ),
                )
                period_start = _date_for_timestamp(session.issued_at)
                cursor.executemany(
                    """
                    INSERT INTO workspace_quotas
                        (workspace_id, quota_key, used, quota_limit, period_start)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            session.workspace_id,
                            quota_key,
                            quota.used,
                            quota.limit,
                            period_start,
                        )
                        for quota_key, quota in session.quotas.items()
                    ],
                )
            connection.commit()

    def get(self, workspace_id: str, *, now: int | None = None) -> WorkspaceSession | None:
        timestamp = _now_timestamp(now)
        today = _date_for_timestamp(timestamp)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT w.issued_at, w.expires_at, r.expires_at, r.policy,
                           q.quota_key,
                           CASE
                               WHEN q.quota_key IN (
                                   'analysis_runs_per_day',
                                   'assistant_requests_per_day'
                               ) AND q.period_start < %s
                               THEN 0
                               ELSE q.used
                           END AS current_used,
                           q.quota_limit
                    FROM workspaces AS w
                    JOIN workspace_retention AS r USING (workspace_id)
                    JOIN workspace_quotas AS q USING (workspace_id)
                    WHERE w.workspace_id = %s
                      AND w.revoked_at IS NULL
                      AND w.expires_at > %s
                      AND r.expires_at > %s
                    ORDER BY q.quota_key
                    """,
                    (
                        today,
                        workspace_id,
                        _utc_datetime(timestamp),
                        _utc_datetime(timestamp),
                    ),
                )
                rows = cursor.fetchall()
        if not rows:
            return None
        issued_at = int(rows[0][0].timestamp())
        expires_at = int(rows[0][1].timestamp())
        retention_expires_at = int(rows[0][2].timestamp())
        if retention_expires_at != expires_at:
            return None
        return _session_from_quota_rows(
            workspace_id=workspace_id,
            issued_at=issued_at,
            expires_at=expires_at,
            retention_policy=rows[0][3],
            quota_rows=[(row[4], row[5], row[6]) for row in rows],
        )

    def revoke(self, workspace_id: str) -> None:
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE workspaces SET revoked_at = CURRENT_TIMESTAMP WHERE workspace_id = %s",
                    (workspace_id,),
                )
            connection.commit()

    def purge_expired(self, *, now: int | None = None) -> int:
        timestamp = _now_timestamp(now)
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM workspaces WHERE expires_at <= %s RETURNING workspace_id",
                    (_utc_datetime(timestamp),),
                )
                deleted = cursor.rowcount
            connection.commit()
        return deleted

    def consume_quota(self, workspace_id: str, quota_key: str) -> QuotaRecord:
        if quota_key not in QUOTA_DEFAULTS:
            raise ValueError(f"Unknown workspace quota: {quota_key}")
        today = _date_for_timestamp(_now_timestamp())
        with closing(self._connect()) as connection:
            with connection.cursor() as cursor:
                if quota_key in DAILY_QUOTAS:
                    cursor.execute(
                        """
                        UPDATE workspace_quotas
                        SET used = 0, period_start = %s
                        WHERE workspace_id = %s
                          AND quota_key = %s
                          AND period_start < %s
                        """,
                        (today, workspace_id, quota_key, today),
                    )
                cursor.execute(
                    """
                    UPDATE workspace_quotas AS q
                    SET used = q.used + 1
                    FROM workspaces AS w
                    WHERE q.workspace_id = %s
                      AND q.quota_key = %s
                      AND q.used < q.quota_limit
                      AND w.workspace_id = q.workspace_id
                      AND w.revoked_at IS NULL
                      AND w.expires_at > CURRENT_TIMESTAMP
                    RETURNING q.used, q.quota_limit
                    """,
                    (workspace_id, quota_key),
                )
                row = cursor.fetchone()
                if row is None:
                    connection.rollback()
                    if self.get(workspace_id) is None:
                        raise WorkspaceNotFoundError(workspace_id)
                    raise QuotaExceededError(quota_key)
            connection.commit()
        return QuotaRecord(used=row[0], limit=row[1])


def build_workspace_repository(database_url: str | None) -> WorkspaceRepository:
    if database_url:
        return PostgresWorkspaceRepository(database_url)
    return InMemoryWorkspaceRepository()
