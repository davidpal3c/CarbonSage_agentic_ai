"""Provider-backed planning constrained to checked-in policy and typed schemas."""

from __future__ import annotations

import json
from typing import Protocol

from agent.llm import load_llm
from agent.policy import load_agent_policy
from domain.agent.models import AgentMessage
from domain.agent.tools import AgentPlan


class AgentPlanningError(RuntimeError):
    """Raised when a configured model cannot return a valid typed plan."""


class AgentPlanner(Protocol):
    async def plan(
        self,
        *,
        question: str,
        history: tuple[AgentMessage, ...],
        tool_schemas: dict[str, dict[str, object]],
    ) -> AgentPlan: ...


class LlmAgentPlanner:
    """Uses a model only for tool selection; application code composes results."""

    def __init__(self) -> None:
        self._planner = load_llm().with_structured_output(AgentPlan)
        self._policy = load_agent_policy()

    async def plan(
        self,
        *,
        question: str,
        history: tuple[AgentMessage, ...],
        tool_schemas: dict[str, dict[str, object]],
    ) -> AgentPlan:
        recent_history = [
            {"role": message.role.value, "content": message.content[:1_000]}
            for message in history[-6:]
        ]
        system_prompt = (
            self._policy
            + "\n\nApproved tool input schemas:\n"
            + json.dumps(tool_schemas, separators=(",", ":"), sort_keys=True)
        )
        user_prompt = json.dumps(
            {"recent_history": recent_history, "question": question},
            separators=(",", ":"),
            sort_keys=True,
        )
        try:
            result = await self._planner.ainvoke(
                (("system", system_prompt), ("human", user_prompt))
            )
            return result if isinstance(result, AgentPlan) else AgentPlan.model_validate(result)
        except Exception as exc:
            raise AgentPlanningError(
                "The configured model could not produce a validated CarbonSage tool plan."
            ) from exc
