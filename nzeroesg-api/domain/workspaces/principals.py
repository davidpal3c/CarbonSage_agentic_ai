"""Common authorization principal for dashboard and future embed access."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from domain.workspaces.sessions import WorkspaceSession


class AuthenticationMethod(StrEnum):
    DEMO_SESSION = "demo_session"
    EMBED_TOKEN = "embed_token"


DASHBOARD_SCOPES = (
    "artifacts:read",
    "artifacts:write",
    "evidence:read",
    "evidence:write",
    "shipments:read",
    "shipments:write",
    "reports:read",
    "reports:write",
)


@dataclass(frozen=True)
class WorkspacePrincipal:
    workspace_id: str
    subject: str
    audience: str
    authentication_method: AuthenticationMethod
    scopes: tuple[str, ...]
    expires_at: int

    def allows(self, scope: str) -> bool:
        return scope in self.scopes

    @classmethod
    def from_demo_session(cls, session: WorkspaceSession) -> WorkspacePrincipal:
        return cls(
            workspace_id=session.workspace_id,
            subject=f"demo:{session.workspace_id}",
            audience="carbonsage-dashboard",
            authentication_method=AuthenticationMethod.DEMO_SESSION,
            scopes=DASHBOARD_SCOPES,
            expires_at=session.expires_at,
        )
