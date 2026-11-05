"""Broad supplier questions are narrowed against real lanes, never ranked or invented."""

from __future__ import annotations

import asyncio

import pytest

from agent.planner import LlmAgentPlanner, _deterministic_plan
from domain.agent.models import AgentMessage, MessageRole
from domain.agent.tools import (
    AgentToolName,
    DiscoverSupplierLanesOutput,
    RecommendShipmentSupplierOutput,
)
from domain.demo_data import DEMO_SHIPMENTS_CSV, DEMO_SUPPLIER_SERVICE_LANES
from domain.evidence.models import SupplierServiceLane
from domain.shipments.ingestion import parse_shipments_csv
from persistence.agent import InMemoryAgentRepository
from persistence.artifacts import InMemoryArtifactRepository
from persistence.evidence import InMemoryEvidenceRepository
from persistence.shipments import InMemoryShipmentRepository
from persistence.supplier_availability import InMemorySupplierAvailabilityRepository
from services.agent_composer import compose_agent_response
from services.agent_runtime import AgentRuntimeService
from services.agent_tools import AgentToolRegistry
from tests.test_agent_runtime import empty_search, principal_for


def _user(text: str) -> AgentMessage:
    return AgentMessage(
        conversation_id="00000000-0000-4000-8000-000000000090",
        workspace_id="demo-discovery",
        role=MessageRole.USER,
        content=text,
    )


class _ModelNeverCalled:
    async def ainvoke(self, _messages):
        raise AssertionError("a deterministic supplier question must not reach the model")


def _model_free_planner() -> LlmAgentPlanner:
    """The real planner with a model that fails on any call."""

    planner = object.__new__(LlmAgentPlanner)
    planner._planner = _ModelNeverCalled()  # noqa: SLF001
    planner._policy = "policy"  # noqa: SLF001
    return planner


def _registry(*, demo: bool = True) -> AgentToolRegistry:
    shipments = InMemoryShipmentRepository()
    lanes = InMemorySupplierAvailabilityRepository()
    if demo:
        shipments.replace_for_workspace(
            "demo-discovery",
            "00000000-0000-4000-8000-000000000091",
            parse_shipments_csv(DEMO_SHIPMENTS_CSV).rows,
        )
        lanes.upsert_many("demo-discovery", DEMO_SUPPLIER_SERVICE_LANES)
    return AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=shipments,
        supplier_availability_repository=lanes,
        evidence_search=empty_search,
    )


def _runtime(registry: AgentToolRegistry) -> AgentRuntimeService:
    return AgentRuntimeService(
        repository=InMemoryAgentRepository(),
        tools=registry,
        planner=_model_free_planner(),
        consume_request=lambda _workspace: None,
    )


def _ask(service: AgentRuntimeService, conversation_id: str, text: str):
    principal = principal_for("demo-discovery")
    return asyncio.run(service.submit_message(principal, conversation_id, text))[1].response


def _plan_arguments(question: str, history=()) -> tuple[str, dict[str, object]] | None:
    plan = _deterministic_plan(question, tuple(history))
    if plan is None:
        return None
    call = plan.calls[0]
    return call.tool_name.value, {
        key: value
        for key, value in call.arguments.model_dump().items()
        if value not in (None, False, "kg", "carbon")
    }


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("What is the best supplier in Canada?", {"place": "Canada"}),
        ("Recommend a supplier", {}),
        ("Which supplier is the most carbon efficient?", {}),
        (
            "Who is the greenest supplier for trains in Canada?",
            {"place": "Canada", "transport_method": "train"},
        ),
        ("Best supplier to ship from China", {"origin": "China"}),
        (
            "Recommend a supplier to ship to Madrid by sea",
            {"destination": "Madrid", "transport_method": "ship"},
        ),
        ("Best supplier for a 500 kg shipment", {"weight_value": 500.0}),
        (
            "Best supplier from Toronto to Vancouver",
            {"origin": "Toronto", "destination": "Vancouver"},
        ),
        ("What's the best vendor in Narnia?", {}),
    ],
)
def test_broad_and_partial_supplier_questions_plan_lane_discovery(question, expected):
    tool, arguments = _plan_arguments(question)

    assert tool == AgentToolName.DISCOVER_SUPPLIER_LANES.value
    assert arguments == expected
    # Never the Canada-to-Canada style route the model used to make up.
    assert arguments.get("origin") != arguments.get("destination") or "origin" not in arguments


@pytest.mark.parametrize(
    "question",
    [
        "Recommend the most carbon efficient supplier for a 1008 kg shipment from Toronto "
        "to Vancouver.",
        "Best supplier for 1008 kg to Vancouver from Toronto",
        "Recommend a supplier for 1008 kg from Toronto to Vancouver, please.",
    ],
)
def test_complete_questions_keep_the_exact_lane_recommendation(question):
    tool, arguments = _plan_arguments(question)

    assert tool == AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER.value
    assert arguments["origin"] == "Toronto"
    assert arguments["destination"] == "Vancouver"
    assert arguments["weight_value"] == 1008.0
    assert "allow_nearest_origin" not in arguments  # False is filtered out of the summary


@pytest.mark.parametrize(
    "question",
    [
        "Which supplier has the lowest emissions?",
        "List my artifacts",
        "How much CO2 for 500 kg from Toronto to Vancouver?",
        "Compare the current freight baseline with train.",
    ],
)
def test_other_questions_are_not_taken_over_by_supplier_narrowing(question):
    plan = _plan_arguments(question)

    assert plan is None or plan[0] != AgentToolName.DISCOVER_SUPPLIER_LANES.value
    assert plan is None or plan[0] != AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER.value


def test_follow_up_details_complete_the_earlier_supplier_question():
    root = _user("What is the best supplier in Canada?")

    route_only = _plan_arguments("Toronto to Vancouver", [root])
    assert route_only is not None
    assert route_only[0] == AgentToolName.DISCOVER_SUPPLIER_LANES.value
    assert route_only[1] == {"origin": "Toronto", "destination": "Vancouver"}

    complete = _plan_arguments(
        "1000 kg",
        [root, _user("Toronto to Vancouver")],
    )
    assert complete is not None
    assert complete[0] == AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER.value
    assert complete[1]["origin"] == "Toronto"
    assert complete[1]["destination"] == "Vancouver"
    assert complete[1]["weight_value"] == 1000.0

    one_reply = _plan_arguments("From Toronto to Vancouver, 1000 kg", [root])
    assert one_reply is not None
    assert one_reply[0] == AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER.value
    assert one_reply[1]["destination"] == "Vancouver"


def test_follow_up_is_not_a_supplier_reply_without_a_supplier_thread():
    assert _plan_arguments("Toronto to Vancouver", [_user("List my artifacts")]) is None
    assert _plan_arguments("1000 kg", []) is None
    interrupted = [
        _user("What is the best supplier in Canada?"),
        _user("Compare the current freight baseline with train."),
    ]
    assert _plan_arguments("Toronto to Vancouver", interrupted) is None


def test_lane_discovery_lists_real_lanes_and_distinguishes_declared_from_history():
    registry = _registry()
    plan = _deterministic_plan("What is the best supplier in Canada?")
    assert plan is not None

    execution = asyncio.run(registry.execute("demo-discovery", plan.calls[0]))

    output = execution.output
    assert isinstance(output, DiscoverSupplierLanesOutput)
    assert output.missing == ["route", "weight"]
    assert output.filters_matched
    assert output.matching_lane_count > 0
    assert {lane.origin for lane in output.lanes} | {lane.destination for lane in output.lanes} >= {
        "Toronto, Canada",
        "Vancouver, Canada",
    }
    toronto_vancouver = next(
        lane
        for lane in output.lanes
        if (lane.origin, lane.destination) == ("Toronto, Canada", "Vancouver, Canada")
    )
    assert toronto_vancouver.basis == "declared_service"
    assert toronto_vancouver.supplier_count == 2
    assert set(toronto_vancouver.transport_methods) == {"train", "truck"}
    # The tool describes coverage and ranks nothing.
    assert not hasattr(output, "recommended_supplier_name")


def test_lane_discovery_falls_back_to_shipment_history_only_without_declared_service():
    registry = _registry(demo=False)
    registry.shipment_repository.replace_for_workspace(
        "demo-discovery",
        "00000000-0000-4000-8000-000000000092",
        parse_shipments_csv(DEMO_SHIPMENTS_CSV).rows,
    )
    registry.supplier_availability_repository.upsert_many(
        "demo-discovery",
        (
            SupplierServiceLane(
                "Declared Co", "Toronto", "Vancouver", "train", 4400, None, None, False
            ),
        ),
    )
    plan = _deterministic_plan("Best supplier from Toronto to Vancouver")
    assert plan is not None

    output = asyncio.run(registry.execute("demo-discovery", plan.calls[0])).output

    assert isinstance(output, DiscoverSupplierLanesOutput)
    assert output.missing == ["weight"]
    assert [lane.basis for lane in output.lanes] == ["declared_service"]
    assert output.lanes[0].suppliers == ["Declared Co"]
    other = asyncio.run(
        registry.execute(
            "demo-discovery",
            _deterministic_plan("Recommend a supplier from Shanghai").calls[0],  # type: ignore[union-attr]
        )
    ).output
    assert isinstance(other, DiscoverSupplierLanesOutput)
    assert {lane.basis for lane in other.lanes} == {"shipment_history"}


def test_uncovered_place_reports_the_miss_and_offers_the_lanes_it_does_cover():
    registry = _registry()
    plan = _deterministic_plan("Recommend a supplier from Yellowknife")
    assert plan is not None

    execution = asyncio.run(registry.execute("demo-discovery", plan.calls[0]))
    response, _ = compose_agent_response((execution,), processing_time_ms=1)

    output = execution.output
    assert isinstance(output, DiscoverSupplierLanesOutput)
    assert not output.filters_matched
    assert output.matching_lane_count == 0
    assert output.lanes
    codes = [block.code for block in response.blocks if block.type == "warning"]
    assert codes == ["supplier_lane_not_covered"]
    assert any(block.type == "suggestions" for block in response.blocks)


def test_empty_workspace_gets_a_no_data_answer_with_the_demo_action_and_no_invention():
    registry = _registry(demo=False)
    plan = _deterministic_plan("What is the best supplier in Canada?")
    assert plan is not None

    execution = asyncio.run(registry.execute("demo-discovery", plan.calls[0]))
    response, _ = compose_agent_response((execution,), processing_time_ms=1)

    output = execution.output
    assert isinstance(output, DiscoverSupplierLanesOutput)
    assert output.total_lane_count == 0
    assert output.lanes == []
    types = [block.type for block in response.blocks]
    assert "table" not in types and "suggestions" not in types and "chart" not in types
    assert any(
        block.type == "warning" and block.code == "no_supplier_lanes" for block in response.blocks
    )
    assert any(
        block.type == "action" and block.action_id == "workspace.load_demo_data"
        for block in response.blocks
    )


def test_broad_answer_explains_the_limit_asks_for_detail_and_offers_complete_questions():
    registry = _registry()
    plan = _deterministic_plan("What is the best supplier in Canada?")
    assert plan is not None
    execution = asyncio.run(registry.execute("demo-discovery", plan.calls[0]))

    response, _ = compose_agent_response((execution,), processing_time_ms=1)

    texts = [block.text for block in response.blocks if block.type == "text"]
    assert "no single best supplier across lanes involving Canada" in texts[0]
    assert any(
        "the route (an origin and a destination)" in t and "the shipment weight" in t for t in texts
    )
    assert any("live availability" in text for text in texts)
    assert not any(block.type == "metric" or block.type == "chart" for block in response.blocks)
    table = next(block for block in response.blocks if block.type == "table")
    assert {row["basis"] for row in table.rows} <= {"Declared service", "Shipment history"}
    suggestions = next(block for block in response.blocks if block.type == "suggestions")
    for option in suggestions.options:
        # Each suggestion is a complete question that takes the exact-lane path.
        planned = _plan_arguments(option.prompt)
        assert planned is not None
        assert planned[0] == AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER.value


def test_conversation_flow_narrows_then_recommends_without_calling_the_model():
    service = _runtime(_registry())
    principal = principal_for("demo-discovery")
    conversation = service.create_conversation(principal)

    broad = _ask(service, conversation.conversation_id, "What is the best supplier in Canada?")
    route = _ask(service, conversation.conversation_id, "Toronto to Vancouver")
    final = _ask(service, conversation.conversation_id, "1000 kg")

    assert broad is not None and route is not None and final is not None
    assert not any(block.type == "metric" for block in broad.blocks)
    assert any(
        block.type == "text" and "the shipment weight" in block.text for block in route.blocks
    )
    exact = next(block for block in final.blocks if block.type == "text")
    assert "Northstar Logistics" in exact.text
    chart = next(block for block in final.blocks if block.type == "chart")
    assert [row["supplier"] for row in chart.rows] == ["Northstar Logistics", "Aurora Packaging"]
    detail = service.get_conversation(principal, conversation.conversation_id)
    assert [event.tool_name for event in detail.tool_events] == [
        "discover_supplier_lanes",
        "discover_supplier_lanes",
        "recommend_shipment_supplier",
    ]


def test_exact_unsupported_route_still_abstains():
    registry = _registry()
    plan = _deterministic_plan(
        "Recommend the most carbon efficient supplier for a 1008 kg shipment from Yellowknife "
        "to Vancouver."
    )
    assert plan is not None
    assert plan.calls[0].tool_name is AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER

    output = asyncio.run(registry.execute("demo-discovery", plan.calls[0])).output

    assert isinstance(output, RecommendShipmentSupplierOutput)
    assert output.recommended_supplier_name is None
    assert output.candidates == []
