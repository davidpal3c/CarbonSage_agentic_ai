"""Provider-backed planning constrained to checked-in policy and typed schemas."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from typing import Protocol

from agent.llm import load_llm
from agent.policy import load_agent_policy
from agent.usage import EMPTY_MODEL_USAGE, ModelInvocationUsage, usage_from_ai_message
from config import settings
from domain.agent.models import AgentMessage
from domain.agent.tools import AgentPlan, AgentToolName, PlannedToolCall
from domain.shipments.locations import country_name, resolve_location


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


# Words that end a place phrase: "from Toronto to Vancouver for 500 kg".
_CLAUSE_WORDS = r"(?:to|into|from|for|with|by|via|using|weighing|that|who|which|and|please|thanks?)"
_TAIL = r",\s*(?=\d|please\b|thanks?\b)"
_RECOMMENDATION_INTENT = ("recommend", "best", "greenest", "cleanest", "efficient")
_OTHER_INTENT = (
    "emission",
    "co2",
    "footprint",
    "evidence",
    "citation",
    "report",
    "trend",
    "compare",
    "scenario",
    "artifact",
    "quality",
    "calculate",
    "estimate",
    "certif",
)
_DISCOVERY_MODE = re.compile(
    r"\b(?:(?:by|via|using|on)\s+(?:an?\s+)?(?P<after>air freight|air|plane|ocean container|"
    r"ocean|sea|ship|rail|train|truck|road)|(?P<bare>air freight|airfreight|ocean freight|"
    r"ocean container|rail|railway|trains?|trucks?|trucking|planes?))\b",
    re.IGNORECASE,
)
_DISCOVERY_MODE_ALIASES = {
    "airfreight": "plane",
    "ocean freight": "ship",
    "railway": "train",
    "trucking": "truck",
    "trains": "train",
    "trucks": "truck",
    "planes": "plane",
    "sea": "ship",
    "road": "truck",
}


@dataclass(frozen=True)
class _SupplierQuestion:
    """What one message says toward a supplier recommendation; None means not said."""

    origin: str | None = None
    destination: str | None = None
    place: str | None = None
    weight_value: float | None = None
    weight_unit: str = "kg"
    transport_method: str | None = None
    cost_requested: bool = False

    @property
    def complete(self) -> bool:
        return None not in (self.origin, self.destination, self.weight_value)


def _known_place(text: str) -> bool:
    return resolve_location(text) is not None or country_name(text) is not None


def _phrases_after(question: str, words: str) -> list[str]:
    """Text following each of ``words``, cut at the next clause word or punctuation."""

    phrases = []
    # The lookahead makes matches overlap, so "to ship to Madrid" yields both "to".
    for match in re.finditer(rf"(?=\b(?:{words})\s+(?P<text>[^.?!;]+))", question, re.IGNORECASE):
        text = re.split(rf"\s+{_CLAUSE_WORDS}\b", match.group("text"), maxsplit=1, flags=re.I)[0]
        phrases.append(re.split(_TAIL, text, maxsplit=1)[0].strip(" ,"))
    return [phrase for phrase in phrases if phrase]


def _scanned_place(question: str) -> str | None:
    """The first known city or country named anywhere in the text."""

    words = re.findall(r"[A-Za-z]+", question)
    for size in (3, 2, 1):
        for start in range(len(words) - size + 1):
            phrase = " ".join(words[start : start + size])
            # Two-letter abbreviations (us, ca, au...) are ordinary words here.
            if (len(phrase) > 2 or phrase.casefold() == "uk") and _known_place(phrase):
                return phrase
    return None


def _origin_before_to(question: str) -> str | None:
    """A known place directly before "to", for a reply like "Toronto to Vancouver"."""

    for match in re.finditer(r"\s+to\s+", question, re.IGNORECASE):
        words = re.findall(r"[A-Za-z]+", question[: match.start()])
        for size in (3, 2, 1):
            phrase = " ".join(words[-size:])
            if words[-size:] and _known_place(phrase):
                return phrase
    return None


def _supplier_question(question: str) -> _SupplierQuestion:
    normalized = " ".join(question.casefold().split())
    weight = _WEIGHT_PATTERN.search(question)
    route = _ROUTE_PATTERN.search(question)
    origin: str | None = None
    destination: str | None = None
    if route is not None:
        origin = route.group("origin").strip()
        destination = re.split(
            rf"\s+{_CLAUSE_WORDS}\b|{_TAIL}",
            route.group("destination").strip(),
            maxsplit=1,
            flags=re.I,
        )[0].strip(" ,")
    else:
        origin = next(
            (
                phrase
                for phrase in _phrases_after(question, "from")
                if _known_place(phrase) or phrase[:1].isupper()
            ),
            None,
        )
        destination = next(
            (phrase for phrase in _phrases_after(question, "to|into") if _known_place(phrase)),
            None,
        )
        if origin is None and destination is not None:
            origin = _origin_before_to(question)
    place = None
    if origin is None and destination is None:
        place = next(
            (
                phrase
                for phrase in _phrases_after(question, "in|within|across|around")
                if _known_place(phrase)
            ),
            None,
        ) or _scanned_place(question)
    mode_match = _DISCOVERY_MODE.search(question)
    mode = None
    if mode_match is not None:
        word = (mode_match.group("after") or mode_match.group("bare")).casefold()
        mode = _TRANSPORT_ALIASES.get(word) or _DISCOVERY_MODE_ALIASES.get(word)
    return _SupplierQuestion(
        origin=origin,
        destination=destination,
        place=place,
        weight_value=(float(weight.group("value")) or None) if weight else None,
        weight_unit=_weight_unit(weight.group("unit")) if weight else "kg",
        transport_method=mode,
        cost_requested=any(
            term in normalized for term in ("cost", "price", "cheapest", "affordable")
        ),
    )


def _is_supplier_request(normalized: str) -> bool:
    return any(term in normalized for term in ("supplier", "vendor", "carrier")) and any(
        term in normalized for term in _RECOMMENDATION_INTENT
    )


def _is_detail_reply(question: str) -> bool:
    """A short message that only supplies route, weight, mode or place details."""

    normalized = " ".join(question.casefold().split())
    details = _supplier_question(question)
    has_detail = any(
        (
            details.origin,
            details.destination,
            details.place,
            details.weight_value,
            details.transport_method,
        )
    )
    return has_detail and len(normalized) <= 200 and not any(t in normalized for t in _OTHER_INTENT)


def _merge_supplier_questions(questions: list[_SupplierQuestion]) -> _SupplierQuestion:
    """Oldest first; each later detail replaces the earlier one."""

    merged = _SupplierQuestion()
    for question in questions:
        merged = _SupplierQuestion(
            origin=question.origin or merged.origin,
            destination=question.destination or merged.destination,
            place=question.place or merged.place,
            weight_value=question.weight_value or merged.weight_value,
            weight_unit=question.weight_unit if question.weight_value else merged.weight_unit,
            transport_method=question.transport_method or merged.transport_method,
            cost_requested=question.cost_requested or merged.cost_requested,
        )
    if merged.origin or merged.destination:
        merged = replace(merged, place=None)
    return merged


def _supplier_thread(history: tuple[AgentMessage, ...]) -> list[str] | None:
    """User turns that continue one supplier question, oldest first.

    The thread is the unbroken run of detail-only replies back to a message that
    asked for a supplier recommendation. Any other turn in between ends it.
    """

    thread: list[str] = []
    for message in reversed(history):
        if message.role.value != "user":
            continue
        normalized = " ".join(message.content.casefold().split())
        if _is_supplier_request(normalized):
            return [message.content, *reversed(thread)]
        if len(thread) < 3 and _is_detail_reply(message.content):
            thread.append(message.content)
            continue
        return None
    return None


def _supplier_plan(details: _SupplierQuestion) -> AgentPlan:
    objective = "carbon_and_cost" if details.cost_requested else "carbon"
    if details.complete:
        assert details.origin and details.destination and details.weight_value
        return AgentPlan(
            calls=[
                PlannedToolCall(
                    call_id="supplier-lane-recommendation",
                    tool_name=AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER,
                    arguments={
                        "origin": details.origin,
                        "destination": details.destination,
                        "weight_value": details.weight_value,
                        "weight_unit": details.weight_unit,
                        "objective": objective,
                        "allow_nearest_origin": False,
                    },
                )
            ]
        )
    return AgentPlan(
        calls=[
            PlannedToolCall(
                call_id="supplier-lane-discovery",
                tool_name=AgentToolName.DISCOVER_SUPPLIER_LANES,
                arguments={
                    "origin": details.origin,
                    "destination": details.destination,
                    "place": details.place,
                    "weight_value": details.weight_value,
                    "weight_unit": details.weight_unit,
                    "transport_method": details.transport_method,
                    "objective": objective,
                },
            )
        ]
    )


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

    # Supplier recommendations: a complete route and weight run the exact-lane
    # tool. A broad or partial question, or a reply that supplies the missing
    # detail, is narrowed against the workspace's real lanes instead.
    details = _supplier_question(question)
    if supplier_recommendation and details.complete:
        return _supplier_plan(details)
    if _is_supplier_request(normalized):
        return _supplier_plan(details)
    thread = _supplier_thread(history) if _is_detail_reply(question) else None
    if thread is not None:
        return _supplier_plan(
            _merge_supplier_questions([*(_supplier_question(text) for text in thread), details])
        )
    return None
