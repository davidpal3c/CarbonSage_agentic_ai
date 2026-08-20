import asyncio
import os
from contextlib import closing
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

import psycopg
import pytest
from pydantic import ValidationError

from agent.planner import _deterministic_plan
from domain.agent.models import (
    AgentResponseEnvelope,
    ChartBlock,
    ChartKind,
    ChartSeries,
    CitationRecord,
    EvidenceStatus,
    EvidenceSupportAssessment,
    TableBlock,
    TableColumn,
    TextBlock,
    ToolEvent,
    ToolEventStatus,
)
from domain.agent.tools import (
    AgentPlan,
    AgentToolName,
    AnalyzeShipmentEmissionsOutput,
    BuildDecisionReportOutput,
    ListWorkspaceArtifactsOutput,
    PlannedToolCall,
    RecommendShipmentSupplierOutput,
)
from domain.artifacts.models import ArtifactKind, ArtifactSourceType, create_artifact
from domain.demo_data import DEMO_SHIPMENTS_CSV
from domain.evidence.models import EvidenceMatch
from domain.shipments.ingestion import parse_shipments_csv
from domain.shipments.models import NormalizedShipment
from domain.workspaces.principals import WorkspacePrincipal
from domain.workspaces.sessions import SessionSigner, WorkspaceSession
from persistence.agent import (
    AgentConversationLimitError,
    AgentConversationNotFoundError,
    InMemoryAgentRepository,
    PostgresAgentRepository,
)
from persistence.artifacts import InMemoryArtifactRepository, PostgresArtifactRepository
from persistence.evidence import InMemoryEvidenceRepository
from persistence.shipments import InMemoryShipmentRepository
from persistence.workspaces import build_workspace_repository
from services.agent_composer import compose_agent_response
from services.agent_runtime import AgentRuntimeService, AgentRuntimeUnavailableError
from services.agent_tools import AgentToolRegistry, ToolExecution


class FixturePlanner:
    def __init__(self, plan: AgentPlan) -> None:
        self.result = plan
        self.questions: list[str] = []

    async def plan(self, *, question, history, tool_schemas):
        self.questions.append(question)
        assert "calculate_freight_emissions" in tool_schemas
        return self.result


def _contains_open_object_schema(value: object) -> bool:
    if isinstance(value, dict):
        if value.get("additionalProperties") is True:
            return True
        return any(_contains_open_object_schema(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_open_object_schema(item) for item in value)
    return False


class FixtureEvidenceAssessor:
    def __init__(self, supported: bool) -> None:
        self.supported = supported
        self.questions: list[str] = []

    async def assess(self, *, question, candidates):
        self.questions.append(question)
        return EvidenceSupportAssessment(
            status="supported" if self.supported else "limited",
            citation_ids=[candidates[0].citation_id] if self.supported else [],
        )


async def empty_search(workspace_id, query, requested_mode):
    return requested_mode, (), None, False


async def related_evidence_search(workspace_id, query, requested_mode):
    return (
        requested_mode,
        (
            EvidenceMatch(
                artifact_id="00000000-0000-4000-8000-000000000010",
                supplier_name="Supplier ABC",
                filename="supplier.txt",
                excerpt="The supplier has announced a target without external validation.",
                page_number=1,
                chunk_index=0,
                document_sha256="a" * 64,
                retrieval_mode=requested_mode.value,
                score=0.5,
            ),
        ),
        None,
        False,
    )


def test_agent_plan_schema_closes_every_tool_argument_object():
    schema = AgentPlan.model_json_schema()

    assert not _contains_open_object_schema(schema)
    argument_schema = schema["$defs"]["PlannedToolCall"]["properties"]["arguments"]
    assert len(argument_schema["anyOf"]) == 9


def test_reported_shipment_questions_use_one_current_question_specific_tool():
    ranking = _deterministic_plan(
        "Based on the current shipments made, indicate the transport mode with the "
        "highest carbon footprint and the supplier involved in it."
    )
    recommendation = _deterministic_plan(
        "Indicate the most recommended and carbon efficient supplier for a 1008 kg "
        "shipment from Toronto to Vancouver."
    )
    trend = _deterministic_plan("Show the monthly emissions trend by transport mode.")

    assert ranking is not None
    assert [call.tool_name for call in ranking.calls] == [AgentToolName.ANALYZE_SHIPMENT_EMISSIONS]
    assert recommendation is not None
    assert [call.tool_name for call in recommendation.calls] == [
        AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER
    ]
    assert recommendation.calls[0].arguments.model_dump() == {
        "origin": "Toronto",
        "destination": "Vancouver",
        "weight_value": 1008.0,
        "weight_unit": "kg",
    }
    assert trend is not None
    assert [call.tool_name for call in trend.calls] == [AgentToolName.ANALYZE_SHIPMENT_EMISSIONS]
    assert trend.calls[0].arguments.model_dump()["granularity"] == "month"


def principal_for(workspace_id: str = "demo-agent") -> WorkspacePrincipal:
    now = int(datetime.now(UTC).timestamp())
    return WorkspacePrincipal.from_demo_session(
        WorkspaceSession.create(
            workspace_id=workspace_id,
            issued_at=now,
            ttl_seconds=24 * 60 * 60,
        )
    )


def runtime_for(
    plan: AgentPlan | None,
    *,
    evidence_search=empty_search,
    evidence_assessor=None,
):
    repository = InMemoryAgentRepository()
    tools = AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=InMemoryShipmentRepository(),
        evidence_search=evidence_search,
    )
    consumed: list[str] = []
    planner = FixturePlanner(plan) if plan is not None else None
    service = AgentRuntimeService(
        repository=repository,
        tools=tools,
        planner=planner,
        consume_request=consumed.append,
        evidence_assessor=evidence_assessor,
    )
    return service, repository, consumed, planner


def test_chart_contract_requires_an_identical_table_equivalent():
    rows = [{"mode": "Rail", "emissions_kg": 2.2}]
    chart = ChartBlock(
        chart_kind=ChartKind.BAR,
        title="Emissions",
        x_key="mode",
        series=[ChartSeries(key="emissions_kg", label="Emissions")],
        rows=rows,
        table_fallback=TableBlock(
            title="Emissions",
            columns=[
                TableColumn(key="mode", label="Mode"),
                TableColumn(key="emissions_kg", label="Emissions"),
            ],
            rows=rows,
        ),
    )

    assert chart.table_fallback.rows == chart.rows
    with pytest.raises(ValidationError, match="identical rows"):
        ChartBlock(
            chart_kind=ChartKind.BAR,
            title="Emissions",
            x_key="mode",
            series=[ChartSeries(key="emissions_kg", label="Emissions")],
            rows=rows,
            table_fallback=TableBlock(
                title="Emissions",
                columns=[
                    TableColumn(key="mode", label="Mode"),
                    TableColumn(key="emissions_kg", label="Emissions"),
                ],
                rows=[{"mode": "Rail", "emissions_kg": 3.3}],
            ),
        )


def test_report_metrics_chart_table_and_action_share_one_typed_result():
    output = BuildDecisionReportOutput(
        shipment_count=2,
        total_emissions_kg=12.5,
        total_emissions_tonnes=0.0125,
        supplier_count=1,
        mode_rows=[
            {
                "mode": "train",
                "shipment_count": 2,
                "weight_kg": 1_500.0,
                "emissions_kg": 12.5,
            }
        ],
        scenario=None,
        factor_source="CarbonSage deterministic factor table",
        factor_version="prototype-2026.1",
        warnings=[],
    )
    execution = ToolExecution(
        call_id="report-1",
        tool_name=AgentToolName.BUILD_DECISION_REPORT,
        output=output,
        event=ToolEvent(
            tool_name=AgentToolName.BUILD_DECISION_REPORT.value,
            status=ToolEventStatus.SUCCEEDED,
            duration_ms=1,
            result_count=1,
        ),
    )

    response, _ = compose_agent_response((execution,), processing_time_ms=2)

    metric = next(block for block in response.blocks if block.type == "metric")
    chart = next(block for block in response.blocks if block.type == "chart")
    assert metric.value == output.total_emissions_kg
    assert chart.rows == output.mode_rows
    assert chart.table_fallback.rows == output.mode_rows
    assert any(
        block.type == "action" and block.action_id == "reports.save_snapshot"
        for block in response.blocks
    )

    empty_execution = execution.__class__(
        call_id="report-empty",
        tool_name=AgentToolName.BUILD_DECISION_REPORT,
        output=output.model_copy(
            update={
                "shipment_count": 0,
                "total_emissions_kg": 0.0,
                "total_emissions_tonnes": 0.0,
                "mode_rows": [],
            }
        ),
        event=execution.event,
    )
    empty_response, _ = compose_agent_response(
        (empty_execution,),
        processing_time_ms=2,
    )
    assert not any(block.type == "action" for block in empty_response.blocks)


def test_empty_workspace_response_offers_demo_data_action():
    execution = ToolExecution(
        call_id="artifacts-empty",
        tool_name=AgentToolName.LIST_WORKSPACE_ARTIFACTS,
        output=ListWorkspaceArtifactsOutput(artifacts=[]),
        event=ToolEvent(
            tool_name=AgentToolName.LIST_WORKSPACE_ARTIFACTS.value,
            status=ToolEventStatus.SUCCEEDED,
            duration_ms=1,
            result_count=0,
        ),
    )

    response, _ = compose_agent_response((execution,), processing_time_ms=2)

    assert any(
        block.type == "warning" and block.code == "no_artifacts" for block in response.blocks
    )
    assert any(
        block.type == "action"
        and block.action_id == "workspace.load_demo_data"
        and block.requires_confirmation is False
        for block in response.blocks
    )


def test_typed_runtime_persists_validated_calculation_and_concise_tool_event():
    plan = AgentPlan(
        calls=[
            PlannedToolCall(
                call_id="calculation-1",
                tool_name=AgentToolName.CALCULATE_FREIGHT_EMISSIONS,
                arguments={
                    "weight_value": 1,
                    "weight_unit": "mt",
                    "distance_value": 100,
                    "distance_unit": "km",
                    "transport_method": "train",
                },
            )
        ]
    )
    service, repository, consumed, planner = runtime_for(plan)
    principal = principal_for()
    conversation = service.create_conversation(principal)

    user_message, assistant_message = asyncio.run(
        service.submit_message(
            principal,
            conversation.conversation_id,
            "Estimate one tonne by rail for 100 km.",
        )
    )

    assert user_message.content == "Estimate one tonne by rail for 100 km."
    assert assistant_message.response is not None
    assert assistant_message.response.schema_version == "1.0"
    metric = next(block for block in assistant_message.response.blocks if block.type == "metric")
    assert metric.value == 2.2
    assert metric.unit == "kg CO2e"
    detail = repository.get_detail(principal.workspace_id, conversation.conversation_id)
    assert detail is not None
    assert len(detail.messages) == 2
    assert detail.tool_events[0].tool_name == "calculate_freight_emissions"
    assert detail.tool_events[0].result_count == 1
    assert consumed == [principal.workspace_id]
    assert planner.questions == ["Estimate one tonne by rail for 100 km."]


def test_typed_shipment_analytics_reconciles_metric_chart_table_and_tool_event():
    workspace_id = "demo-agent-analytics"
    shipment_repository = InMemoryShipmentRepository()
    shipment_repository.replace_for_workspace(
        workspace_id,
        "00000000-0000-4000-8000-000000000030",
        (
            NormalizedShipment(
                shipment_id="S-001",
                shipment_date=date(2025, 12, 5),
                origin="Edmonton",
                destination="Calgary",
                weight_kg=1_000,
                distance_km=100,
                transport_method="truck",
                source_row=2,
            ),
            NormalizedShipment(
                shipment_id="S-002",
                shipment_date=date(2026, 1, 12),
                origin="Calgary",
                destination="Vancouver",
                weight_kg=2_000,
                distance_km=1_000,
                transport_method="train",
                source_row=3,
            ),
        ),
    )
    registry = AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=shipment_repository,
        evidence_search=empty_search,
    )
    execution = asyncio.run(
        registry.execute(
            workspace_id,
            PlannedToolCall(
                call_id="analytics-1",
                tool_name=AgentToolName.ANALYZE_SHIPMENT_EMISSIONS,
                arguments={"granularity": "month"},
            ),
        )
    )

    assert execution.event.status is ToolEventStatus.SUCCEEDED
    assert execution.event.result_count == 2
    assert isinstance(execution.output, AnalyzeShipmentEmissionsOutput)
    response, _ = compose_agent_response((execution,), processing_time_ms=2)
    emissions_metric = next(
        block for block in response.blocks if block.type == "metric" and block.unit == "kg CO2e"
    )
    chart = next(
        block
        for block in response.blocks
        if block.type == "chart" and block.title == "Monthly emissions by transport mode"
    )
    chart_total = sum(float(row[series.key]) for row in chart.rows for series in chart.series)
    assert round(chart_total, 6) == emissions_metric.value == 50.2
    assert chart.table_fallback.rows == chart.rows
    assert chart.table_fallback.columns[-1].key == "total_emissions_kg"


def test_highest_footprint_prompt_names_the_mode_and_supplier_from_demo_rows():
    workspace_id = "demo-agent-mode-supplier-ranking"
    shipment_repository = InMemoryShipmentRepository()
    parsed = parse_shipments_csv(DEMO_SHIPMENTS_CSV)
    shipment_repository.replace_for_workspace(
        workspace_id,
        "00000000-0000-4000-8000-000000000033",
        parsed.rows,
    )
    registry = AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=shipment_repository,
        evidence_search=empty_search,
    )
    plan = _deterministic_plan(
        "Based on the current shipments made, indicate the transport mode with the "
        "highest carbon footprint and the supplier involved in it."
    )
    assert plan is not None

    execution = asyncio.run(registry.execute(workspace_id, plan.calls[0]))

    assert isinstance(execution.output, AnalyzeShipmentEmissionsOutput)
    assert execution.output.mode_breakdown[0].transport_method == "plane"
    assert execution.output.mode_breakdown[0].suppliers[0].supplier_name == ("Nimbus Controls")
    response, _ = compose_agent_response((execution,), processing_time_ms=1)
    direct_answer = next(block for block in response.blocks if block.type == "text")
    assert "Plane has the highest aggregate shipment footprint" in direct_answer.text
    assert "Nimbus Controls" in direct_answer.text
    assert any(
        block.type == "chart" and block.title == "Emissions by transport mode"
        for block in response.blocks
    )
    assert not any(block.type == "artifact_reference" for block in response.blocks)


def test_supplier_recommendation_uses_exact_lane_data_and_renders_a_chart():
    workspace_id = "demo-agent-supplier-recommendation"
    shipment_repository = InMemoryShipmentRepository()
    parsed = parse_shipments_csv(DEMO_SHIPMENTS_CSV)
    assert parsed.errors == ()
    shipment_repository.replace_for_workspace(
        workspace_id,
        "00000000-0000-4000-8000-000000000031",
        parsed.rows,
    )
    registry = AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=shipment_repository,
        evidence_search=empty_search,
    )
    plan = _deterministic_plan(
        "Recommend the most carbon efficient supplier for a 1008 kg shipment from "
        "Toronto to Vancouver."
    )
    assert plan is not None

    execution = asyncio.run(registry.execute(workspace_id, plan.calls[0]))

    assert isinstance(execution.output, RecommendShipmentSupplierOutput)
    assert execution.output.recommended_supplier_name == "Northstar Logistics"
    assert execution.output.recommended_transport_method == "train"
    assert execution.output.recommended_emissions_kg == 97.5744
    assert [candidate.supplier_name for candidate in execution.output.candidates] == [
        "Northstar Logistics",
        "Aurora Packaging",
    ]
    assert execution.output.candidates[0].distance_km == 4_400
    response, _ = compose_agent_response((execution,), processing_time_ms=1)
    direct_answer = next(block for block in response.blocks if block.type == "text")
    chart = next(block for block in response.blocks if block.type == "chart")
    assert "Northstar Logistics" in direct_answer.text
    assert chart.title == "Supplier-linked lane options"
    assert chart.rows == chart.table_fallback.rows
    assert chart.rows[0]["emissions_kg"] == 97.5744


def test_supplier_recommendation_abstains_without_an_exact_lane():
    workspace_id = "demo-agent-supplier-abstention"
    shipment_repository = InMemoryShipmentRepository()
    parsed = parse_shipments_csv(DEMO_SHIPMENTS_CSV)
    shipment_repository.replace_for_workspace(
        workspace_id,
        "00000000-0000-4000-8000-000000000032",
        parsed.rows,
    )
    registry = AgentToolRegistry(
        artifact_repository=InMemoryArtifactRepository(),
        evidence_repository=InMemoryEvidenceRepository(),
        shipment_repository=shipment_repository,
        evidence_search=empty_search,
    )
    plan = _deterministic_plan(
        "Recommend the most carbon efficient supplier for a 1008 kg shipment from "
        "Yellowknife to Vancouver."
    )
    assert plan is not None

    execution = asyncio.run(registry.execute(workspace_id, plan.calls[0]))

    assert isinstance(execution.output, RecommendShipmentSupplierOutput)
    assert execution.output.recommended_supplier_name is None
    assert execution.output.candidates == []
    assert "cannot recommend" in execution.output.warnings[0]
    response, _ = compose_agent_response((execution,), processing_time_ms=1)
    assert not any(block.type == "chart" for block in response.blocks)
    assert any(
        block.type == "warning" and "cannot recommend" in block.message for block in response.blocks
    )


def test_empty_plan_returns_a_valid_unsupported_request_warning():
    service, repository, consumed, _ = runtime_for(AgentPlan(calls=[]))
    principal = principal_for("demo-agent-unsupported")
    conversation = service.create_conversation(principal)

    _, assistant_message = asyncio.run(
        service.submit_message(
            principal,
            conversation.conversation_id,
            "Make an autonomous purchasing decision.",
        )
    )

    assert assistant_message.response is not None
    assert assistant_message.response.evidence_status is EvidenceStatus.NOT_REQUIRED
    assert len(assistant_message.response.blocks) == 1
    warning = assistant_message.response.blocks[0]
    assert warning.type == "warning"
    assert warning.code == "unsupported_request"
    detail = repository.get_detail(principal.workspace_id, conversation.conversation_id)
    assert detail is not None
    assert detail.tool_events == []
    assert consumed == [principal.workspace_id]


def test_empty_evidence_result_returns_a_limitation_without_citation():
    plan = AgentPlan(
        calls=[
            PlannedToolCall(
                call_id="evidence-1",
                tool_name=AgentToolName.SEARCH_SUPPLIER_EVIDENCE,
                arguments={"query": "SBTi validated target", "mode": "hybrid"},
            )
        ]
    )
    service, _, _, _ = runtime_for(plan)
    principal = principal_for("demo-agent-evidence")
    conversation = service.create_conversation(principal)

    _, assistant_message = asyncio.run(
        service.submit_message(
            principal,
            conversation.conversation_id,
            "Whose target is validated by SBTi?",
        )
    )

    assert assistant_message.response is not None
    assert assistant_message.response.evidence_status is EvidenceStatus.LIMITED
    assert not any(block.type == "citation" for block in assistant_message.response.blocks)
    warning = next(block for block in assistant_message.response.blocks if block.type == "warning")
    assert warning.code == "evidence_limit"


def test_evidence_citations_require_direct_support_approval():
    plan = AgentPlan(
        calls=[
            PlannedToolCall(
                call_id="evidence-support",
                tool_name=AgentToolName.SEARCH_SUPPLIER_EVIDENCE,
                arguments={
                    "query": "Does the provided evidence lack external validation?",
                    "mode": "hybrid",
                },
            )
        ]
    )
    assessor = FixtureEvidenceAssessor(supported=True)
    service, _, _, _ = runtime_for(
        plan,
        evidence_search=related_evidence_search,
        evidence_assessor=assessor,
    )
    principal = principal_for("demo-agent-supported-evidence")
    conversation = service.create_conversation(principal)

    _, assistant_message = asyncio.run(
        service.submit_message(
            principal,
            conversation.conversation_id,
            "Does the provided evidence lack external validation?",
        )
    )

    assert assistant_message.response is not None
    assert assistant_message.response.evidence_status is EvidenceStatus.SUPPORTED
    assert any(block.type == "citation" for block in assistant_message.response.blocks)
    assert assessor.questions == ["Does the provided evidence lack external validation?"]


def test_related_evidence_fails_closed_when_support_cannot_be_established():
    plan = AgentPlan(
        calls=[
            PlannedToolCall(
                call_id="evidence-limited",
                tool_name=AgentToolName.SEARCH_SUPPLIER_EVIDENCE,
                arguments={"query": "Whose target is SBTi validated?", "mode": "hybrid"},
            )
        ]
    )
    service, _, _, _ = runtime_for(
        plan,
        evidence_search=related_evidence_search,
    )
    principal = principal_for("demo-agent-related-evidence")
    conversation = service.create_conversation(principal)

    _, assistant_message = asyncio.run(
        service.submit_message(
            principal,
            conversation.conversation_id,
            "Whose target is SBTi validated?",
        )
    )

    assert assistant_message.response is not None
    assert assistant_message.response.evidence_status is EvidenceStatus.LIMITED
    assert not any(block.type == "citation" for block in assistant_message.response.blocks)
    assert any(
        block.type == "warning" and block.code == "evidence_limit"
        for block in assistant_message.response.blocks
    )


def test_disabled_planner_does_not_consume_quota_or_break_deterministic_workflows():
    service, _, consumed, _ = runtime_for(None)
    principal = principal_for("demo-agent-disabled")
    conversation = service.create_conversation(principal)

    with pytest.raises(AgentRuntimeUnavailableError, match="disabled"):
        asyncio.run(
            service.submit_message(
                principal,
                conversation.conversation_id,
                "List my artifacts.",
            )
        )

    assert consumed == []


def test_conversations_are_workspace_scoped_and_message_state_is_bounded():
    repository = InMemoryAgentRepository()
    first = principal_for("demo-agent-first")
    second = principal_for("demo-agent-second")
    conversation = repository.create_conversation(
        workspace_id=first.workspace_id,
        created_by=first.subject,
        expires_at=datetime.fromtimestamp(first.expires_at, UTC),
        title="Isolation",
    )
    assert repository.get_detail(second.workspace_id, conversation.conversation_id) is None

    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.NOT_REQUIRED,
        blocks=[TextBlock(text="Validated response")],
        processing_time_ms=1,
    )
    for index in range(10):
        repository.append_exchange(
            workspace_id=first.workspace_id,
            conversation_id=conversation.conversation_id,
            user_content=f"Question {index}",
            response=response,
            citations=(),
            tool_events=(),
        )
    with pytest.raises(AgentConversationLimitError, match="message limit"):
        repository.append_exchange(
            workspace_id=first.workspace_id,
            conversation_id=conversation.conversation_id,
            user_content="One too many",
            response=response,
            citations=(),
            tool_events=(),
        )
    with pytest.raises(AgentConversationNotFoundError):
        repository.close_conversation(second.workspace_id, conversation.conversation_id)


def test_repository_rejects_citation_rows_that_do_not_match_the_response():
    repository = InMemoryAgentRepository()
    principal = principal_for("demo-agent-citation-integrity")
    conversation = repository.create_conversation(
        workspace_id=principal.workspace_id,
        created_by=principal.subject,
        expires_at=datetime.fromtimestamp(principal.expires_at, UTC),
        title="Citation integrity",
    )
    citation = CitationRecord(
        artifact_id="00000000-0000-4000-8000-000000000020",
        filename="evidence.txt",
        document_sha256="b" * 64,
        chunk_index=0,
        excerpt="A supported synthetic statement.",
    )
    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.SUPPORTED,
        blocks=[citation.to_block()],
        processing_time_ms=1,
    )

    with pytest.raises(ValueError, match="exactly match"):
        repository.append_exchange(
            workspace_id=principal.workspace_id,
            conversation_id=conversation.conversation_id,
            user_content="Show the evidence.",
            response=response,
            citations=(),
            tool_events=(),
        )


def test_expired_conversation_is_purged_with_derived_state():
    repository = InMemoryAgentRepository()
    now = datetime.now(UTC)
    conversation = repository.create_conversation(
        workspace_id="demo-agent-expiry",
        created_by="test",
        expires_at=now + timedelta(hours=1),
        title="Expiry",
        now=now,
    )

    assert repository.purge_expired(now=now + timedelta(hours=1)) == 1
    assert (
        repository.get_detail(
            conversation.workspace_id,
            conversation.conversation_id,
            now=now + timedelta(hours=1),
        )
        is None
    )


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="PostgreSQL integration test")
def test_postgres_agent_persists_validated_response_citations_and_events():
    database_url = os.environ["DATABASE_URL"]
    workspace_repository = build_workspace_repository(database_url)
    agent_repository = PostgresAgentRepository(database_url)
    artifact_repository = PostgresArtifactRepository(database_url)
    signer = SessionSigner(
        "agent-integration-secret-at-least-32-characters",
        ttl_seconds=3_600,
    )
    session, _ = signer.issue()
    workspace_repository.create(session)
    artifact = create_artifact(
        workspace_id=session.workspace_id,
        kind=ArtifactKind.EVIDENCE_DOCUMENT,
        title="Supplier evidence",
        source_type=ArtifactSourceType.LOCAL_UPLOAD,
        created_by="integration-test",
        media_type="text/plain",
        content_sha256="a" * 64,
    )
    artifact_repository.create(artifact)
    citation = CitationRecord(
        artifact_id=artifact.artifact_id,
        filename="supplier.txt",
        document_sha256="a" * 64,
        page_number=1,
        chunk_index=0,
        excerpt="The supplier reports a validated emissions-reduction target.",
    )
    response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.SUPPORTED,
        blocks=[
            TextBlock(text="The workspace evidence supports this answer."),
            citation.to_block(),
        ],
        processing_time_ms=7,
    )
    event = ToolEvent(
        tool_name="search_supplier_evidence",
        status=ToolEventStatus.SUCCEEDED,
        duration_ms=5,
        result_count=1,
        artifact_ids=[artifact.artifact_id],
    )
    second_response = AgentResponseEnvelope(
        evidence_status=EvidenceStatus.NOT_REQUIRED,
        blocks=[TextBlock(text="The calculation completed without external evidence.")],
        processing_time_ms=3,
    )
    second_event = ToolEvent(
        tool_name="calculate_freight_emissions",
        status=ToolEventStatus.SUCCEEDED,
        duration_ms=2,
        result_count=1,
    )

    try:
        conversation = agent_repository.create_conversation(
            workspace_id=session.workspace_id,
            created_by="integration-test",
            expires_at=datetime.fromtimestamp(session.expires_at, UTC),
            title="Evidence decision",
        )
        _, assistant = agent_repository.append_exchange(
            workspace_id=session.workspace_id,
            conversation_id=conversation.conversation_id,
            user_content="Is this supplier target validated?",
            response=response,
            citations=(citation,),
            tool_events=(event,),
        )
        agent_repository.append_exchange(
            workspace_id=session.workspace_id,
            conversation_id=conversation.conversation_id,
            user_content="Calculate one validated freight estimate.",
            response=second_response,
            citations=(),
            tool_events=(second_event,),
        )

        detail = agent_repository.get_detail(
            session.workspace_id,
            conversation.conversation_id,
        )
        assert detail is not None
        assert detail.messages[1].response == assistant.response == response
        assert detail.messages[-1].response == second_response
        assert detail.tool_events == [event, second_event]
        assert (
            agent_repository.get_detail(
                "demo-agent-other-workspace",
                conversation.conversation_id,
            )
            is None
        )
        with closing(psycopg.connect(database_url)) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT citation_id, response_message_id, workspace_id
                    FROM agent_citations
                    WHERE citation_id = %s
                    """,
                    (citation.citation_id,),
                )
                assert cursor.fetchone() == (
                    UUID(citation.citation_id),
                    UUID(assistant.message_id),
                    session.workspace_id,
                )
    finally:
        workspace_repository.revoke(session.workspace_id)
