"""Authenticated conversation resources for the typed CarbonSage agent."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from agent.evidence_support import LlmEvidenceSupportAssessor
from agent.planner import LlmAgentPlanner
from agent.usage import ModelInvocationUsage
from api.artifacts import artifact_repository
from api.evidence import (
    _search_with_mode,
    evidence_repository,
    supplier_availability_repository,
)
from api.shipments import shipment_repository
from api.workspaces import require_workspace_principal, workspace_repository
from config import database_url_for_runtime, settings
from domain.agent.models import (
    AGENT_POLICY_VERSION,
    AGENT_RESPONSE_SCHEMA_VERSION,
    AgentConversation,
    AgentMessage,
    ConversationDetail,
)
from domain.evidence.retrieval import RetrievalMode
from domain.workspaces.principals import WorkspacePrincipal
from persistence.agent import (
    AgentConversationLimitError,
    AgentConversationNotFoundError,
    build_agent_repository,
)
from persistence.agent_usage import build_agent_usage_repository
from persistence.workspaces import QuotaExceededError, WorkspaceNotFoundError
from services.agent_runtime import (
    AgentRuntimeService,
    AgentRuntimeUnavailableError,
    AgentScopeError,
)
from services.agent_tools import AgentToolRegistry

logger = logging.getLogger(__name__)
agent_router = APIRouter(prefix="/agent", tags=["agent"])
agent_repository = build_agent_repository(database_url_for_runtime())
agent_usage_repository = build_agent_usage_repository(database_url_for_runtime())


async def _agent_evidence_search(
    workspace_id: str,
    query: str,
    requested_mode: RetrievalMode,
):
    return await _search_with_mode(
        workspace_id=workspace_id,
        query=query,
        requested_mode=requested_mode,
    )


def _consume_assistant_request(workspace_id: str) -> None:
    workspace_repository.consume_quota(workspace_id, "assistant_requests_per_day")


def _record_agent_usage(workspace_id: str, usage: ModelInvocationUsage) -> None:
    try:
        agent_usage_repository.record(workspace_id, usage)
    except Exception:
        logger.exception("CarbonSage agent usage accounting failed")


def _configured_model_components():
    if not settings.assistant_enabled:
        return None, None
    try:
        return LlmAgentPlanner(), LlmEvidenceSupportAssessor()
    except RuntimeError:
        logger.exception("CarbonSage agent model configuration is invalid")
        return None, None


agent_tools = AgentToolRegistry(
    artifact_repository=artifact_repository,
    evidence_repository=evidence_repository,
    shipment_repository=shipment_repository,
    supplier_availability_repository=supplier_availability_repository,
    evidence_search=_agent_evidence_search,
)
agent_planner, agent_evidence_assessor = _configured_model_components()
agent_runtime_service = AgentRuntimeService(
    repository=agent_repository,
    tools=agent_tools,
    planner=agent_planner,
    consume_request=_consume_assistant_request,
    record_usage=_record_agent_usage,
    evidence_assessor=agent_evidence_assessor,
)


class CreateConversationRequest(BaseModel):
    title: str = Field(default="CarbonSage decision", min_length=1, max_length=160)


class ConversationListResponse(BaseModel):
    conversations: list[AgentConversation]


class SubmitMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4_000)


class MessageExchangeResponse(BaseModel):
    user_message: AgentMessage
    assistant_message: AgentMessage


class AgentUsageResponse(BaseModel):
    questions_used: int
    question_limit: int
    questions_remaining: int
    model_calls: int
    spend_usd: float
    spend_is_estimate: bool
    currency: str = "USD"
    resets_at: datetime


def _runtime_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, AgentConversationNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The conversation was not found in this workspace.",
        )
    if isinstance(exc, AgentConversationLimitError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, AgentScopeError):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The active credential does not allow this agent operation.",
        )
    if isinstance(exc, QuotaExceededError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The daily assistant quota for this workspace has been reached.",
        )
    if isinstance(exc, WorkspaceNotFoundError):
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The workspace session is no longer active.",
        )
    if isinstance(exc, AgentRuntimeUnavailableError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    if isinstance(exc, ValueError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="The CarbonSage agent is temporarily unavailable.",
    )


@agent_router.get("/health")
async def agent_health() -> dict[str, str | bool | None]:
    configured_model = (
        settings.openai_model
        if settings.llm_provider == "openai"
        else settings.openrouter_model
        if settings.llm_provider == "openrouter"
        else None
    )
    return {
        "status": "ok",
        "available": (
            agent_runtime_service.planner is not None
            and agent_runtime_service.evidence_assessor is not None
        ),
        "policy_version": AGENT_POLICY_VERSION,
        "response_schema_version": AGENT_RESPONSE_SCHEMA_VERSION,
        "provider": settings.llm_provider or None,
        "model": configured_model,
    }


@agent_router.get("/usage", response_model=AgentUsageResponse)
async def agent_usage(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> AgentUsageResponse:
    session = workspace_repository.get(principal.workspace_id)
    if session is None:
        raise _runtime_exception(WorkspaceNotFoundError(principal.workspace_id))
    quota = session.quotas["assistant_requests_per_day"]
    usage = agent_usage_repository.get_today(principal.workspace_id)
    tomorrow = datetime.now(UTC).date() + timedelta(days=1)
    return AgentUsageResponse(
        questions_used=quota.used,
        question_limit=quota.limit,
        questions_remaining=max(0, quota.limit - quota.used),
        model_calls=usage.model_calls,
        spend_usd=float(round(usage.total_cost_usd, 8)),
        spend_is_estimate=usage.cost_is_estimate,
        resets_at=datetime.combine(tomorrow, time.min, tzinfo=UTC),
    )


@agent_router.post(
    "/conversations",
    response_model=AgentConversation,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    payload: CreateConversationRequest,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> AgentConversation:
    try:
        return agent_runtime_service.create_conversation(principal, title=payload.title)
    except Exception as exc:
        raise _runtime_exception(exc) from exc


@agent_router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ConversationListResponse:
    try:
        conversations = agent_runtime_service.list_conversations(principal)
    except Exception as exc:
        raise _runtime_exception(exc) from exc
    return ConversationListResponse(conversations=list(conversations))


@agent_router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetail,
)
async def get_conversation(
    conversation_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> ConversationDetail:
    try:
        return agent_runtime_service.get_conversation(principal, conversation_id)
    except Exception as exc:
        raise _runtime_exception(exc) from exc


@agent_router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageExchangeResponse,
)
async def submit_message(
    conversation_id: str,
    payload: SubmitMessageRequest,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> MessageExchangeResponse:
    try:
        user_message, assistant_message = await agent_runtime_service.submit_message(
            principal,
            conversation_id,
            payload.content,
        )
    except Exception as exc:
        if not isinstance(
            exc,
            AgentConversationLimitError
            | AgentConversationNotFoundError
            | AgentRuntimeUnavailableError
            | AgentScopeError
            | QuotaExceededError
            | WorkspaceNotFoundError
            | ValueError,
        ):
            logger.exception(
                "Typed agent request failed",
                extra={"conversation_id": conversation_id},
            )
        raise _runtime_exception(exc) from exc
    return MessageExchangeResponse(
        user_message=user_message,
        assistant_message=assistant_message,
    )


@agent_router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def close_conversation(
    conversation_id: str,
    principal: Annotated[WorkspacePrincipal, Depends(require_workspace_principal)],
) -> Response:
    try:
        agent_runtime_service.close_conversation(principal, conversation_id)
    except Exception as exc:
        raise _runtime_exception(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
