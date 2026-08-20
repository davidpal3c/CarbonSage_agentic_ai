import os
import time

import pytest

from domain.workspaces.sessions import QuotaRecord, SessionSigner, WorkspaceSession
from persistence.workspaces import (
    InMemoryWorkspaceRepository,
    QuotaExceededError,
    build_workspace_repository,
)


def test_repository_persists_isolated_quota_usage_and_revocation():
    repository = build_workspace_repository(os.getenv("DATABASE_URL"))
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=3_600)
    first, _ = signer.issue(now=int(time.time()))
    second, _ = signer.issue(now=int(time.time()))

    repository.create(first)
    repository.create(second)
    assert repository.get(first.workspace_id).workspace_id == first.workspace_id
    assert repository.get(second.workspace_id).workspace_id == second.workspace_id

    for _ in range(10):
        repository.consume_quota(first.workspace_id, "analysis_runs_per_day")
    with pytest.raises(QuotaExceededError):
        repository.consume_quota(first.workspace_id, "analysis_runs_per_day")

    first_after_usage = repository.get(first.workspace_id)
    second_after_usage = repository.get(second.workspace_id)
    assert first_after_usage.quotas["analysis_runs_per_day"].used == 10
    assert second_after_usage.quotas["analysis_runs_per_day"].used == 0

    repository.revoke(first.workspace_id)
    assert repository.get(first.workspace_id) is None
    assert repository.get(second.workspace_id) is not None


def test_repository_purges_expired_workspace_records():
    repository = build_workspace_repository(os.getenv("DATABASE_URL"))
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=5)
    issued, _ = signer.issue(now=int(time.time()) - 10)

    repository.create(issued)

    assert repository.purge_expired(now=int(time.time())) >= 1
    assert repository.get(issued.workspace_id) is None


def test_reading_workspace_usage_resets_daily_quotas_after_utc_day_change():
    repository = InMemoryWorkspaceRepository()
    now = int(time.time())
    signer = SessionSigner(
        "test-secret-that-is-at-least-32-characters",
        ttl_seconds=3 * 24 * 60 * 60,
    )
    issued, _ = signer.issue(now=now - 24 * 60 * 60)
    quotas = dict(issued.quotas)
    quotas["assistant_requests_per_day"] = QuotaRecord(used=7, limit=15)
    repository.create(
        WorkspaceSession(
            workspace_id=issued.workspace_id,
            issued_at=issued.issued_at,
            expires_at=issued.expires_at,
            quotas=quotas,
            retention=issued.retention,
        )
    )

    refreshed = repository.get(issued.workspace_id, now=now)

    assert refreshed is not None
    assert refreshed.quotas["assistant_requests_per_day"] == QuotaRecord(
        used=0,
        limit=15,
    )
