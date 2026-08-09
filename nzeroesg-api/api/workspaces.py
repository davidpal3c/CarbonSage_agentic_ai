"""HTTP boundary for controlled demo workspace access."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel

from config import database_url_for_runtime, settings
from domain.workspaces.principals import WorkspacePrincipal
from domain.workspaces.sessions import SessionError, SessionSigner, WorkspaceSession
from persistence.workspaces import build_workspace_repository

SESSION_COOKIE_NAME = "nzeroesg_session"
_signer = SessionSigner(
    settings.demo_session_secret,
    ttl_seconds=settings.demo_workspace_ttl_hours * 60 * 60,
)
workspace_repository = build_workspace_repository(database_url_for_runtime())


class WorkspaceSessionResponse(BaseModel):
    workspace_id: str
    issued_at: int
    expires_at: int
    quotas: dict[str, dict[str, int]]
    retention: dict[str, int | str]


workspace_router = APIRouter(prefix="/demo", tags=["workspace"])


def _response_for(session: WorkspaceSession) -> WorkspaceSessionResponse:
    return WorkspaceSessionResponse.model_validate(session.to_dict())


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=_signer.ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


async def require_workspace_session(
    nzeroesg_session: str | None = Cookie(default=None),
) -> WorkspaceSession:
    try:
        signed_session = _signer.verify(nzeroesg_session)
        stored_session = workspace_repository.get(signed_session.workspace_id)
        if stored_session is None or stored_session.expires_at > signed_session.expires_at:
            raise SessionError("The workspace session is no longer active.")
        return stored_session
    except SessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Cookie"},
        ) from exc


async def require_workspace_principal(
    session: Annotated[WorkspaceSession, Depends(require_workspace_session)],
) -> WorkspacePrincipal:
    """Resolve the dashboard cookie to the common application principal."""

    return WorkspacePrincipal.from_demo_session(session)


@workspace_router.post(
    "/session",
    response_model=WorkspaceSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_demo_session(response: Response) -> WorkspaceSessionResponse:
    workspace_repository.purge_expired()
    session, token = _signer.issue()
    workspace_repository.create(session)
    _set_session_cookie(response, token)
    return _response_for(session)


@workspace_router.get("/session", response_model=WorkspaceSessionResponse)
async def get_demo_session(
    session: Annotated[WorkspaceSession, Depends(require_workspace_session)],
) -> WorkspaceSessionResponse:
    return _response_for(session)


@workspace_router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
async def delete_demo_session(
    response: Response,
    nzeroesg_session: str | None = Cookie(default=None),
) -> None:
    if nzeroesg_session:
        try:
            session = _signer.verify(nzeroesg_session)
        except SessionError:
            session = None
        if session:
            workspace_repository.revoke(session.workspace_id)
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
