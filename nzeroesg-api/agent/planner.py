"""Provider-backed planning constrained to checked-in policy and typed schemas."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Protocol

from agent.llm import load_llm
from agent.policy import load_agent_policy
from agent.usage import EMPTY_MODEL_USAGE, ModelInvocationUsage, usage_from_ai_message
from config import settings
from domain.agent.models import AgentMessage
from domain.agent.tools import AgentPlan, AgentToolName, PlannedToolCall


class AgentPlanningError(RuntimeError):
    """Raised when a configured model cannot return a valid typed plan."""


@dataclass(frozen=True)
class PlannedAgentResult:
    plan: AgentPlan
    usage: ModelInvocationUsage = EMPTY_MODEL_USAGE


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
        self._planner = load_llm().with_structured_output(
            AgentPlan,
            include_raw=True,
            method="json_schema",
            strict=True,
        )
        self._policy = load_agent_policy()

    async def plan(
        self,
        *,
        question: str,
        history: tuple[AgentMessage, ...],
        tool_schemas: dict[str, dict[str, object]],
    ) -> AgentPlan:
        result = await self.plan_with_usage(
            question=question,
            history=history,
            tool_schemas=tool_schemas,
        )
        return result.plan

    async def plan_with_usage(
        self,
        *,
        question: str,
        history: tuple[AgentMessage, ...],
        tool_schemas: dict[str, dict[str, object]],
    ) -> PlannedAgentResult:
        deterministic_plan = _deterministic_plan(question, history)
        if deterministic_plan is not None:
            return PlannedAgentResult(plan=deterministic_plan)
        recent_history = [
            {"role": message.role.value, "content": message.content[:1_000]}
            for message in history[-6:]
            if _question_references_history(question)
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
            if not isinstance(result, dict) or result.get("parsed") is None:
                raise ValueError("The planning response was not parsed.")
            configured_model = (
                settings.openai_model
                if settings.llm_provider == "openai"
                else settings.openrouter_model
            )
            return PlannedAgentResult(
                plan=AgentPlan.model_validate(result["parsed"]),
                usage=usage_from_ai_message(result.get("raw"), model=configured_model),
            )
        except Exception as exc:
            raise AgentPlanningError(
                "The configured model could not produce a validated CarbonSage tool plan."
            ) from exc


_WEIGHT_PATTERN = re.compile(
    r"\b(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>kg|kilograms?|g|grams?|lb|lbs|pounds?|mt|tonnes?|metric\s+tons?)\b",
    re.IGNORECASE,
)
_ROUTE_PATTERN = re.compile(
    r"\bfrom\s+(?P<origin>.+?)\s+to\s+(?P<destination>.+?)(?=\s*(?:[.!?]\s*$|$))",
    re.IGNORECASE,
)

_TRANSPORT_ALIASES = {
    "air": "plane",
    "air freight": "plane",
    "ocean": "ship",
    "ocean container": "ship",
    "plane": "plane",
    "rail": "train",
    "ship": "ship",
    "train": "train",
    "truck": "truck",
}


def _weight_unit(value: str) -> str:
    normalized = value.casefold().replace(" ", "")
    if normalized in {"g", "gram", "grams"}:
        return "g"
    if normalized in {"lb", "lbs", "pound", "pounds"}:
        return "lb"
    if normalized in {"mt", "tonne", "tonnes", "metricton", "metrictons"}:
        return "mt"
    return "kg"


def _question_references_history(question: str) -> bool:
    normalized = question.casefold()
    return any(
        phrase in normalized
        for phrase in (
            "that result",
            "that answer",
            "same route",
            "same shipment",
            "previous",
            "instead",
            "those suppliers",
            "it compared",
            "closest city",
            "nearest city",
            "closest origin",
            "nearest origin",
        )
    )


def _requested_transport_mode(question: str) -> str | None:
    normalized = question.casefold()
    for alias in sorted(_TRANSPORT_ALIASES, key=len, reverse=True):
        if re.search(rf"\b{re.escape(alias)}\b", normalized):
            return _TRANSPORT_ALIASES[alias]
    return None


def _previous_supplier_route(
    history: tuple[AgentMessage, ...],
) -> tuple[str, str, float, str, str] | None:
    for message in reversed(history):
        if message.role.value != "user":
            continue
        weight_match = _WEIGHT_PATTERN.search(message.content)
        route_match = _ROUTE_PATTERN.search(message.content)
        if weight_match is None or route_match is None:
            continue
        normalized = " ".join(message.content.casefold().split())
        objective = (
            "carbon_and_cost"
            if any(term in normalized for term in ("cost", "price", "cheapest", "affordable"))
            else "carbon"
        )
        return (
            route_match.group("origin").strip(),
            route_match.group("destination").strip(),
            float(weight_match.group("value")),
            _weight_unit(weight_match.group("unit")),
            objective,
        )
    return None


def _deterministic_plan(
    question: str,
    history: tuple[AgentMessage, ...] = (),
) -> AgentPlan | None:
    normalized = " ".join(question.casefold().split())
    requested_mode = _requested_transport_mode(question)
    scenario_comparison = (
        requested_mode is not None
        and any(term in normalized for term in ("compare", "comparison", "scenario"))
        and any(term in normalized for term in ("baseline", "current freight", "all shipment"))
    )
    if scenario_comparison:
        return AgentPlan(
            calls=[
                PlannedToolCall(
                    call_id="transport-scenario-comparison",
                    tool_name=AgentToolName.COMPARE_TRANSPORT_SCENARIOS,
                    arguments={"alternative_transport_method": requested_mode},
                )
            ]
        )

    nearest_origin_request = any(
        phrase in normalized
        for phrase in ("closest city", "nearest city", "closest origin", "nearest origin")
    ) and any(term in normalized for term in ("recommend", "ship", "supplier", "send"))
    if nearest_origin_request:
        previous_route = _previous_supplier_route(history)
        if previous_route is not None:
            origin, destination, weight_value, weight_unit, objective = previous_route
            return AgentPlan(
                calls=[
                    PlannedToolCall(
                        call_id="nearest-supported-origin-recommendation",
                        tool_name=AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER,
                        arguments={
                            "origin": origin,
                            "destination": destination,
                            "weight_value": weight_value,
                            "weight_unit": weight_unit,
                            "objective": objective,
                            "allow_nearest_origin": True,
                        },
                    )
                ]
            )

    supplier_recommendation = "supplier" in normalized and any(
        term in normalized for term in ("recommend", "efficient", "lowest", "best")
    )
    cost_requested = any(term in normalized for term in ("cost", "price", "cheapest", "affordable"))
    shipment_footprint_question = (
        any(term in normalized for term in ("shipment", "shipments"))
        and any(term in normalized for term in ("highest", "largest", "most"))
        and any(term in normalized for term in ("carbon", "emission", "footprint"))
        and not supplier_recommendation
    )
    shipment_trend_question = any(
        term in normalized for term in ("emission", "emissions", "footprint")
    ) and any(term in normalized for term in ("monthly", "yearly", "annual", "trend"))
    if shipment_footprint_question or shipment_trend_question:
        arguments: dict[str, object] = {
            "granularity": (
                "year" if any(term in normalized for term in ("yearly", "annual")) else "month"
            )
        }
        if shipment_trend_question and requested_mode is not None:
            arguments["transport_methods"] = [requested_mode]
        return AgentPlan(
            calls=[
                PlannedToolCall(
                    call_id="shipment-emissions-ranking",
                    tool_name=AgentToolName.ANALYZE_SHIPMENT_EMISSIONS,
                    arguments=arguments,
                )
            ]
        )

    weight_match = _WEIGHT_PATTERN.search(question)
    route_match = _ROUTE_PATTERN.search(question)
    if supplier_recommendation and weight_match and route_match:
        return AgentPlan(
            calls=[
                PlannedToolCall(
                    call_id="supplier-lane-recommendation",
                    tool_name=AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER,
                    arguments={
                        "origin": route_match.group("origin").strip(),
                        "destination": route_match.group("destination").strip(),
                        "weight_value": float(weight_match.group("value")),
                        "weight_unit": _weight_unit(weight_match.group("unit")),
                        "objective": "carbon_and_cost" if cost_requested else "carbon",
                        "allow_nearest_origin": False,
                    },
                )
            ]
        )
    return None
