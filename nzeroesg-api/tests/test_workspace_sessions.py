import pytest

from config import _demo_session_secret, _optional_value
from domain.workspaces.sessions import SessionError, SessionSigner


def test_signed_session_round_trip_preserves_workspace_and_policy_records():
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=60)

    issued, token = signer.issue(now=1_000)
    verified = signer.verify(token, now=1_001)

    assert verified.workspace_id == issued.workspace_id
    assert verified.expires_at == 1_060
    assert verified.quotas["evidence_documents"].limit == 3
    assert verified.retention.policy == "workspace_and_derived_data"


def test_sessions_are_unique_and_cannot_be_tampered_with():
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=60)

    first, first_token = signer.issue(now=1_000)
    second, second_token = signer.issue(now=1_000)

    assert first.workspace_id != second.workspace_id
    assert signer.verify(first_token, now=1_001).workspace_id == first.workspace_id
    assert signer.verify(second_token, now=1_001).workspace_id == second.workspace_id
    with pytest.raises(SessionError, match="valid workspace session"):
        signer.verify(f"{first_token}x", now=1_001)


def test_expired_session_is_rejected_at_retention_boundary():
    signer = SessionSigner("test-secret-that-is-at-least-32-characters", ttl_seconds=60)
    _, token = signer.issue(now=1_000)

    with pytest.raises(SessionError, match="expired"):
        signer.verify(token, now=1_060)


def test_short_secret_is_rejected():
    with pytest.raises(ValueError, match="at least 32"):
        SessionSigner("too-short", ttl_seconds=60)


def test_production_does_not_fall_back_to_a_development_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DEMO_SESSION_SECRET", raising=False)

    assert _demo_session_secret() == ""


def test_external_values_are_trimmed_and_empty_values_are_rejected():
    assert _optional_value("  openai/gpt-4.1-mini  ") == "openai/gpt-4.1-mini"
    assert _optional_value("  secret-value\t") == "secret-value"
    assert _optional_value("   ") is None
    assert _optional_value(None) is None
