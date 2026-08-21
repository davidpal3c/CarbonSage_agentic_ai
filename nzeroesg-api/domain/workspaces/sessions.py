"""Signed, expiring demo-workspace sessions.

The session is deliberately self-contained for the first workspace slice. It
does not act as a conversation cache or a source of user-owned records. Later
PostgreSQL-backed repositories will use the workspace identifier from this
session as their mandatory query boundary.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any

ASSISTANT_REQUESTS_PER_DAY = 15


class SessionError(ValueError):
    """Raised when a signed workspace session is missing or invalid."""


@dataclass(frozen=True)
class QuotaRecord:
    """A bounded workspace allowance carried in the session claims."""

    used: int
    limit: int

    def to_dict(self) -> dict[str, int]:
        return {"used": self.used, "limit": self.limit}

    @classmethod
    def from_payload(cls, value: Any) -> QuotaRecord:
        if not isinstance(value, dict):
            raise SessionError("Invalid workspace quota record.")
        used = value.get("used")
        limit = value.get("limit")
        if (
            isinstance(used, bool)
            or isinstance(limit, bool)
            or not isinstance(used, int)
            or not isinstance(limit, int)
            or used < 0
            or limit < 0
            or used > limit
        ):
            raise SessionError("Invalid workspace quota record.")
        return cls(used=used, limit=limit)


@dataclass(frozen=True)
class RetentionRecord:
    """Retention metadata for a workspace and its derived demo data."""

    expires_at: int
    policy: str = "workspace_and_derived_data"

    def to_dict(self) -> dict[str, int | str]:
        return {"expires_at": self.expires_at, "policy": self.policy}

    @classmethod
    def from_payload(cls, value: Any) -> RetentionRecord:
        if not isinstance(value, dict):
            raise SessionError("Invalid workspace retention record.")
        expires_at = value.get("expires_at")
        policy = value.get("policy")
        if (
            isinstance(expires_at, bool)
            or not isinstance(expires_at, int)
            or expires_at <= 0
            or policy != "workspace_and_derived_data"
        ):
            raise SessionError("Invalid workspace retention record.")
        return cls(expires_at=expires_at, policy=policy)


@dataclass(frozen=True)
class WorkspaceSession:
    """The one-workspace context selected by a valid signed cookie."""

    workspace_id: str
    issued_at: int
    expires_at: int
    quotas: dict[str, QuotaRecord]
    retention: RetentionRecord

    @classmethod
    def create(
        cls,
        *,
        workspace_id: str | None = None,
        issued_at: int,
        ttl_seconds: int,
    ) -> WorkspaceSession:
        if ttl_seconds <= 0:
            raise SessionError("Workspace session TTL must be positive.")
        expires_at = issued_at + ttl_seconds
        return cls(
            workspace_id=workspace_id or f"demo-{secrets.token_urlsafe(12)}",
            issued_at=issued_at,
            expires_at=expires_at,
            quotas={
                "evidence_documents": QuotaRecord(used=0, limit=3),
                "analysis_runs_per_day": QuotaRecord(used=0, limit=10),
                "assistant_requests_per_day": QuotaRecord(
                    used=0,
                    limit=ASSISTANT_REQUESTS_PER_DAY,
                ),
            },
            retention=RetentionRecord(expires_at=expires_at),
        )

    def to_payload(self) -> dict[str, Any]:
        return {
            "version": 1,
            "workspace_id": self.workspace_id,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "quotas": {name: quota.to_dict() for name, quota in self.quotas.items()},
            "retention": self.retention.to_dict(),
        }

    @classmethod
    def from_payload(cls, payload: Any) -> WorkspaceSession:
        if not isinstance(payload, dict) or payload.get("version") != 1:
            raise SessionError("Unsupported workspace session.")
        workspace_id = payload.get("workspace_id")
        issued_at = payload.get("issued_at")
        expires_at = payload.get("expires_at")
        quotas = payload.get("quotas")
        if (
            not isinstance(workspace_id, str)
            or not workspace_id.startswith("demo-")
            or len(workspace_id) > 80
            or isinstance(issued_at, bool)
            or not isinstance(issued_at, int)
            or isinstance(expires_at, bool)
            or not isinstance(expires_at, int)
            or expires_at <= issued_at
            or not isinstance(quotas, dict)
        ):
            raise SessionError("Invalid workspace session claims.")
        parsed_quotas = {name: QuotaRecord.from_payload(value) for name, value in quotas.items()}
        retention = RetentionRecord.from_payload(payload.get("retention"))
        if retention.expires_at != expires_at:
            raise SessionError("Workspace retention does not match session expiry.")
        return cls(
            workspace_id=workspace_id,
            issued_at=issued_at,
            expires_at=expires_at,
            quotas=parsed_quotas,
            retention=retention,
        )

    def is_expired(self, *, now: int | None = None) -> bool:
        return (int(time.time()) if now is None else now) >= self.expires_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "workspace_id": self.workspace_id,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "quotas": {name: quota.to_dict() for name, quota in self.quotas.items()},
            "retention": self.retention.to_dict(),
        }


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


class SessionSigner:
    """Issue and verify HMAC-signed workspace session tokens."""

    def __init__(self, secret: str, *, ttl_seconds: int) -> None:
        if len(secret) < 32:
            raise ValueError("DEMO_SESSION_SECRET must contain at least 32 characters.")
        if ttl_seconds <= 0:
            raise ValueError("Demo workspace TTL must be positive.")
        self._secret = secret.encode("utf-8")
        self.ttl_seconds = ttl_seconds

    def issue(
        self,
        *,
        workspace_id: str | None = None,
        now: int | None = None,
    ) -> tuple[WorkspaceSession, str]:
        issued_at = int(time.time()) if now is None else now
        session = WorkspaceSession.create(
            workspace_id=workspace_id,
            issued_at=issued_at,
            ttl_seconds=self.ttl_seconds,
        )
        payload = _encode(
            json.dumps(session.to_payload(), separators=(",", ":"), sort_keys=True).encode("utf-8")
        )
        return session, f"{payload}.{self._signature(payload)}"

    def verify(self, token: str | None, *, now: int | None = None) -> WorkspaceSession:
        if not token or token.count(".") != 1:
            raise SessionError("A valid workspace session is required.")
        payload, signature = token.split(".")
        expected = self._signature(payload)
        if not hmac.compare_digest(signature, expected):
            raise SessionError("A valid workspace session is required.")
        try:
            session = WorkspaceSession.from_payload(json.loads(_decode(payload)))
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            raise SessionError("A valid workspace session is required.") from exc
        if session.is_expired(now=now):
            raise SessionError("The workspace session has expired.")
        return session

    def _signature(self, payload: str) -> str:
        digest = hmac.new(self._secret, payload.encode("ascii"), hashlib.sha256).digest()
        return _encode(digest)
