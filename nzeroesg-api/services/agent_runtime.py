"""Authenticated orchestration for bounded typed conversations."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from time import perf_counter

from agent.evidence_support import EvidenceSupportAssessor, EvidenceSupportError
from agent.planner import AgentPlanner, AgentPlanningError
from agent.usage import ModelInvocationUsage
from domain.agent.models import (
    AgentConversation,
    AgentMessage,
    ConversationDetail,
    EvidenceSupportAssessment,
)
from domain.workspaces.principals import WorkspacePrincipal
from persistence.agent import (
    AgentConversationLimitError,
    AgentConversationNotFoundError,
    AgentRepository,
)
from services.agent_composer import compose_agent_response
from services.agent_tools import AgentToolRegistry


class AgentRuntimeUnavailableError(RuntimeError):
    """Raised when a configured model planner is disabled or unavailable."""


class AgentScopeError(PermissionError):
    """Raised when a principal lacks an agent scope."""


class AgentRuntimeService:
    def __init__(
        self,
        *,
        repository: AgentRepository,
        tools: AgentToolRegistry,
        planner: AgentPlanner | None,
        consume_request: Callable[[str], None],
        record_usage: Callable[[str, ModelInvocationUsage], None] | None = None,
        evidence_assessor: EvidenceSupportAssessor | None = None,
    ) -> None:
        self.repository = repository
        self.tools = tools
        self.planner = planner
        self.consume_request = consume_request
        self.record_usage = record_usage
        self.evidence_assessor = evidence_assessor

    @staticmethod
    def _require_scope(principal: WorkspacePrincipal, scope: str) -> None:
        if not principal.allows(scope):
            raise AgentScopeError(scope)

    def create_conversation(
        self,
        principal: WorkspacePrincipal,
        *,
        title: str = "CarbonSage decision",
        now: datetime | None = None,
    ) -> AgentConversation:
        self._require_scope(principal, "agent:write")
        timestamp = now or datetime.now(UTC)
        self.repository.purge_expired(now=timestamp)
        return self.repository.create_conversation(
            workspace_id=principal.workspace_id,
            created_by=principal.subject,
            expires_at=datetime.fromtimestamp(principal.expires_at, UTC),
            title=title,
            now=timestamp,
        )

    def list_conversations(
        self,
        principal: WorkspacePrincipal,
        *,
        now: datetime | None = None,
    ) -> tuple[AgentConversation, ...]:
        self._require_scope(principal, "agent:read")
        return self.repository.list_conversations(principal.workspace_id, now=now)

    def get_conversation(
        self,
        principal: WorkspacePrincipal,
        conversation_id: str,
        *,
        now: datetime | None = None,
    ) -> ConversationDetail:
        self._require_scope(principal, "agent:read")
        detail = self.repository.get_detail(
            principal.workspace_id,
            conversation_id,
            now=now,
        )
        if detail is None:
            raise AgentConversationNotFoundError(conversation_id)
        return detail

    async def submit_message(
        self,
        principal: WorkspacePrincipal,
        conversation_id: str,
        content: str,
    ) -> tuple[AgentMessage, AgentMessage]:
        self._require_scope(principal, "agent:write")
        question = " ".join(content.strip().split())
        if not question:
            raise ValueError("A conversation message is required.")
        if len(question) > 4_000:
            raise ValueError("Conversation messages must contain at most 4,000 characters.")
        detail = self.get_conversation(principal, conversation_id)
        if self.planner is None:
            raise AgentRuntimeUnavailableError(
                "The CarbonSage agent is disabled in this environment."
            )

        self.consume_request(principal.workspace_id)
        started_at = perf_counter()
        try:
            plan_with_usage = getattr(self.planner, "plan_with_usage", None)
            if callable(plan_with_usage):
                planned = await plan_with_usage(
                    question=question,
                    history=tuple(detail.messages),
                    tool_schemas=self.tools.input_schemas(),
                )
                plan = planned.plan
                if self.record_usage is not None:
                    self.record_usage(principal.workspace_id, planned.usage)
            else:
                plan = await self.planner.plan(
                    question=question,
                    history=tuple(detail.messages),
                    tool_schemas=self.tools.input_schemas(),
                )
        except AgentPlanningError as exc:
            raise AgentRuntimeUnavailableError(str(exc)) from exc

        executions = tuple(
            [await self.tools.execute(principal.workspace_id, call) for call in plan.calls]
        )
        candidates = tuple(
            {
                citation.citation_id: citation
                for execution in executions
                for citation in execution.citations
            }.values()
        )
        evidence_support = None
        if candidates:
            evidence_support = EvidenceSupportAssessment(status="limited")
            if self.evidence_assessor is not None:
                try:
                    assess_with_usage = getattr(
                        self.evidence_assessor,
                        "assess_with_usage",
                        None,
                    )
                    if callable(assess_with_usage):
                        assessed_result = await assess_with_usage(
                            question=question,
                            candidates=candidates,
                        )
                        assessed = assessed_result.assessment
                        if self.record_usage is not None:
                            self.record_usage(
                                principal.workspace_id,
                                assessed_result.usage,
                            )
                    else:
                        assessed = await self.evidence_assessor.assess(
                            question=question,
                            candidates=candidates,
                        )
                    candidate_ids = {citation.citation_id for citation in candidates}
                    if set(assessed.citation_ids) <= candidate_ids:
                        evidence_support = assessed
                except EvidenceSupportError:
                    pass
        elapsed_ms = max(0, round((perf_counter() - started_at) * 1_000))
        response, citations = compose_agent_response(
            executions,
            processing_time_ms=elapsed_ms,
            evidence_support=evidence_support,
            question=question,
        )
        return self.repository.append_exchange(
            workspace_id=principal.workspace_id,
            conversation_id=conversation_id,
            user_content=question,
            response=response,
            citations=citations,
            tool_events=tuple(execution.event for execution in executions),
        )

    def close_conversation(
        self,
        principal: WorkspacePrincipal,
        conversation_id: str,
    ) -> AgentConversation:
        self._require_scope(principal, "agent:write")
        return self.repository.close_conversation(
            principal.workspace_id,
            conversation_id,
        )


__all__ = [
    "AgentConversationLimitError",
    "AgentConversationNotFoundError",
    "AgentRuntimeService",
    "AgentRuntimeUnavailableError",
    "AgentScopeError",
]
