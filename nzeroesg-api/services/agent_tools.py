"""Workspace-scoped execution of CarbonSage's approved typed agent tools."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from time import perf_counter

from pydantic import BaseModel, ValidationError

from domain.agent.models import CitationRecord, ToolEvent, ToolEventStatus
from domain.agent.tools import (
    TOOL_INPUT_MODELS,
    AgentToolName,
    ArtifactToolItem,
    BuildDecisionReportInput,
    BuildDecisionReportOutput,
    CalculateFreightEmissionsInput,
    CalculateFreightEmissionsOutput,
    CalculationProvenance,
    CompareTransportScenariosInput,
    CompareTransportScenariosOutput,
    DataQualityIssue,
    EvidenceToolMatch,
    GetCitationContextInput,
    GetCitationContextOutput,
    ListWorkspaceArtifactsInput,
    ListWorkspaceArtifactsOutput,
    PlannedToolCall,
    ScenarioShipmentOutput,
    SearchSupplierEvidenceInput,
    SearchSupplierEvidenceOutput,
    SummarizeDataQualityInput,
    SummarizeDataQualityOutput,
)
from domain.artifacts.models import ArtifactKind
from domain.emissions.calculator import calculate_emissions
from domain.evidence.models import EvidenceMatch
from domain.evidence.retrieval import RetrievalMode
from domain.scenarios.comparison import compare_shipment_modes
from domain.shipments.analysis import analyze_shipments
from persistence.artifacts import ArtifactRepository
from persistence.evidence import EvidenceRepository
from persistence.shipments import ShipmentRepository

EvidenceSearch = Callable[
    [str, str, RetrievalMode],
    Awaitable[tuple[RetrievalMode, tuple[EvidenceMatch, ...], str | None, bool]],
]


@dataclass(frozen=True)
class ToolExecution:
    call_id: str
    tool_name: AgentToolName
    output: BaseModel | None
    event: ToolEvent
    citations: tuple[CitationRecord, ...] = ()
    artifact_ids: tuple[str, ...] = ()
    error_message: str | None = None


def _duration_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1_000))


def _citation(match: EvidenceMatch) -> CitationRecord:
    return CitationRecord(
        artifact_id=match.artifact_id,
        filename=match.filename,
        document_sha256=match.document_sha256,
        page_number=match.page_number,
        chunk_index=match.chunk_index,
        excerpt=match.excerpt,
    )


class AgentToolRegistry:
    """Validates model-selected arguments before invoking deterministic services."""

    def __init__(
        self,
        *,
        artifact_repository: ArtifactRepository,
        evidence_repository: EvidenceRepository,
        shipment_repository: ShipmentRepository,
        evidence_search: EvidenceSearch,
    ) -> None:
        self.artifact_repository = artifact_repository
        self.evidence_repository = evidence_repository
        self.shipment_repository = shipment_repository
        self.evidence_search = evidence_search

    def input_schemas(self) -> dict[str, dict[str, object]]:
        return {
            tool_name.value: input_model.model_json_schema()
            for tool_name, input_model in TOOL_INPUT_MODELS.items()
        }

    async def execute(self, workspace_id: str, call: PlannedToolCall) -> ToolExecution:
        started_at = perf_counter()
        input_model = TOOL_INPUT_MODELS[call.tool_name]
        try:
            validated = input_model.model_validate(call.arguments.model_dump())
        except ValidationError:
            return ToolExecution(
                call_id=call.call_id,
                tool_name=call.tool_name,
                output=None,
                event=ToolEvent(
                    tool_name=call.tool_name.value,
                    status=ToolEventStatus.FAILED,
                    duration_ms=_duration_ms(started_at),
                    error_code="tool_validation_error",
                ),
                error_message="The requested tool arguments did not pass validation.",
            )

        try:
            output, citations, artifact_ids, result_count = await self._dispatch(
                workspace_id,
                call.tool_name,
                validated,
            )
        except ValueError as exc:
            return ToolExecution(
                call_id=call.call_id,
                tool_name=call.tool_name,
                output=None,
                event=ToolEvent(
                    tool_name=call.tool_name.value,
                    status=ToolEventStatus.FAILED,
                    duration_ms=_duration_ms(started_at),
                    error_code="tool_precondition_failed",
                ),
                error_message=str(exc),
            )

        return ToolExecution(
            call_id=call.call_id,
            tool_name=call.tool_name,
            output=output,
            citations=citations,
            artifact_ids=artifact_ids,
            event=ToolEvent(
                tool_name=call.tool_name.value,
                status=ToolEventStatus.SUCCEEDED,
                duration_ms=_duration_ms(started_at),
                result_count=result_count,
                artifact_ids=list(artifact_ids),
            ),
        )

    async def _dispatch(
        self,
        workspace_id: str,
        tool_name: AgentToolName,
        payload: BaseModel,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        if tool_name is AgentToolName.LIST_WORKSPACE_ARTIFACTS:
            return self._list_artifacts(
                workspace_id,
                ListWorkspaceArtifactsInput.model_validate(payload),
            )
        if tool_name is AgentToolName.SEARCH_SUPPLIER_EVIDENCE:
            return await self._search_evidence(
                workspace_id,
                SearchSupplierEvidenceInput.model_validate(payload),
            )
        if tool_name is AgentToolName.GET_CITATION_CONTEXT:
            return self._citation_context(
                workspace_id,
                GetCitationContextInput.model_validate(payload),
            )
        if tool_name is AgentToolName.CALCULATE_FREIGHT_EMISSIONS:
            return self._calculate(
                CalculateFreightEmissionsInput.model_validate(payload),
            )
        if tool_name is AgentToolName.COMPARE_TRANSPORT_SCENARIOS:
            return self._compare_scenario(
                workspace_id,
                CompareTransportScenariosInput.model_validate(payload),
            )
        if tool_name is AgentToolName.SUMMARIZE_DATA_QUALITY:
            return self._data_quality(
                workspace_id,
                SummarizeDataQualityInput.model_validate(payload),
            )
        return self._report_data(
            workspace_id,
            BuildDecisionReportInput.model_validate(payload),
        )

    def _list_artifacts(
        self,
        workspace_id: str,
        _payload: ListWorkspaceArtifactsInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        artifacts = self.artifact_repository.list_for_workspace(workspace_id)
        output = ListWorkspaceArtifactsOutput(
            artifacts=[
                ArtifactToolItem(
                    artifact_id=artifact.artifact_id,
                    title=artifact.title,
                    kind=artifact.kind.value,
                    status=artifact.status.value,
                    source_type=artifact.source_type.value,
                    created_at=artifact.created_at.isoformat(),
                )
                for artifact in artifacts
            ]
        )
        artifact_ids = tuple(artifact.artifact_id for artifact in artifacts)
        return output, (), artifact_ids, len(artifacts)

    async def _search_evidence(
        self,
        workspace_id: str,
        payload: SearchSupplierEvidenceInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        requested_mode = RetrievalMode(payload.mode)
        mode_used, matches, warning, semantic_available = await self.evidence_search(
            workspace_id,
            payload.query,
            requested_mode,
        )
        selected = matches[: payload.limit]
        citations = tuple(_citation(match) for match in selected)
        output = SearchSupplierEvidenceOutput(
            query=payload.query,
            requested_mode=requested_mode.value,
            mode_used=mode_used.value,
            semantic_available=semantic_available,
            warning=warning,
            matches=[
                EvidenceToolMatch(
                    supplier_name=match.supplier_name,
                    excerpt=match.excerpt,
                    retrieval_mode=match.retrieval_mode,
                    score=match.score,
                    citation=citation,
                )
                for match, citation in zip(selected, citations, strict=True)
            ],
        )
        artifact_ids = tuple(dict.fromkeys(match.artifact_id for match in selected))
        return output, citations, artifact_ids, len(selected)

    def _citation_context(
        self,
        workspace_id: str,
        payload: GetCitationContextInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        match = self.evidence_repository.get_citation_context(
            workspace_id,
            payload.artifact_id,
            payload.chunk_index,
        )
        if match is None:
            raise ValueError("The cited evidence chunk is unavailable in this workspace.")
        citation = _citation(match)
        return (
            GetCitationContextOutput(citation=citation, supplier_name=match.supplier_name),
            (citation,),
            (match.artifact_id,),
            1,
        )

    @staticmethod
    def _calculate(
        payload: CalculateFreightEmissionsInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        result = calculate_emissions(
            weight_value=payload.weight_value,
            weight_unit=payload.weight_unit,
            distance_value=payload.distance_value,
            distance_unit=payload.distance_unit,
            mode=payload.transport_method,
            distance_method=payload.distance_method,
            origin=payload.origin,
            destination=payload.destination,
        )
        result_data = result.to_dict()
        output = CalculateFreightEmissionsOutput(
            transport_method=str(result_data["method"]),
            emissions_kg=float(result_data["emissions_kg"]),
            emissions_tonnes=float(result_data["emissions_tonnes"]),
            weight_kg=float(result_data["weight_kg"]),
            distance_km=float(result_data["distance_km"]),
            provenance=CalculationProvenance(
                source=str(result_data["source"]),
                version=str(result_data["source_version"]),
                factor_kg_co2e_per_tonne_km=float(result_data["factor_kg_co2e_per_tonne_km"]),
                distance_method=str(result_data["distance_method"]),
                assumptions=[str(value) for value in result_data["assumptions"]],
                warnings=[str(value) for value in result_data["warnings"]],
            ),
        )
        return output, (), (), 1

    def _compare_scenario(
        self,
        workspace_id: str,
        payload: CompareTransportScenariosInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        comparison = compare_shipment_modes(
            self.shipment_repository.list_for_workspace(workspace_id),
            alternative_mode=payload.alternative_transport_method,
        )
        output = self._scenario_output(comparison.to_dict())
        artifact_ids = tuple(
            artifact.artifact_id
            for artifact in self.artifact_repository.list_for_workspace(workspace_id)
            if artifact.kind is ArtifactKind.SHIPMENT_DATASET
        )
        return output, (), artifact_ids, comparison.shipment_count

    @staticmethod
    def _scenario_output(payload: dict[str, object]) -> CompareTransportScenariosOutput:
        return CompareTransportScenariosOutput(
            baseline_mode=str(payload["baseline_mode"]),
            alternative_mode=str(payload["alternative_mode"]),
            shipment_count=int(payload["shipment_count"]),
            baseline_total_kg=float(payload["baseline_total_kg"]),
            alternative_total_kg=float(payload["alternative_total_kg"]),
            delta_kg=float(payload["delta_kg"]),
            delta_percent=(
                float(payload["delta_percent"]) if payload["delta_percent"] is not None else None
            ),
            shipment_results=[
                ScenarioShipmentOutput.model_validate(result)
                for result in payload["shipment_results"]
            ],
            factor_source=str(payload["factor_source"]),
            factor_version=str(payload["factor_version"]),
            assumptions=[str(value) for value in payload["assumptions"]],
        )

    def _data_quality(
        self,
        workspace_id: str,
        _payload: SummarizeDataQualityInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        shipments = self.shipment_repository.list_for_workspace(workspace_id)
        suppliers = self.evidence_repository.list_suppliers(workspace_id)
        issues: list[DataQualityIssue] = []
        if not shipments:
            issues.append(
                DataQualityIssue(
                    area="shipments",
                    severity="warning",
                    message="No active shipment dataset is available.",
                )
            )
        if not suppliers:
            issues.append(
                DataQualityIssue(
                    area="evidence",
                    severity="warning",
                    message="No active supplier evidence is available.",
                )
            )
        for supplier in suppliers:
            if supplier.missing_fields:
                issues.append(
                    DataQualityIssue(
                        area=f"supplier:{supplier.name}",
                        severity="warning",
                        message="Missing " + ", ".join(supplier.missing_fields) + ".",
                    )
                )
        evidence_count = sum(supplier.document_count for supplier in suppliers)
        complete_suppliers = sum(1 for supplier in suppliers if not supplier.missing_fields)
        artifacts = self.artifact_repository.list_for_workspace(workspace_id)
        output = SummarizeDataQualityOutput(
            shipment_count=len(shipments),
            supplier_count=len(suppliers),
            evidence_document_count=evidence_count,
            complete_supplier_count=complete_suppliers,
            issues=issues,
        )
        artifact_ids = tuple(artifact.artifact_id for artifact in artifacts)
        return output, (), artifact_ids, len(issues)

    def _report_data(
        self,
        workspace_id: str,
        payload: BuildDecisionReportInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        shipments = self.shipment_repository.list_for_workspace(workspace_id)
        analysis = analyze_shipments(shipments)
        suppliers = self.evidence_repository.list_suppliers(workspace_id)
        scenario = None
        if payload.alternative_transport_method is not None:
            comparison = compare_shipment_modes(
                shipments,
                alternative_mode=payload.alternative_transport_method,
            )
            scenario = self._scenario_output(comparison.to_dict())
        mode_rows = [
            {
                "mode": mode,
                "shipment_count": values.shipment_count,
                "weight_kg": round(values.weight_kg, 6),
                "emissions_kg": round(values.emissions_kg, 6),
            }
            for mode, values in sorted(analysis.mode_breakdown.items())
        ]
        output = BuildDecisionReportOutput(
            shipment_count=analysis.shipment_count,
            total_emissions_kg=analysis.total_emissions_kg,
            total_emissions_tonnes=round(analysis.total_emissions_kg / 1_000, 6),
            supplier_count=len(suppliers),
            mode_rows=mode_rows,
            scenario=scenario,
            factor_source=analysis.factor_source,
            factor_version=analysis.factor_version,
            warnings=list(analysis.warnings),
        )
        artifacts = self.artifact_repository.list_for_workspace(workspace_id)
        artifact_ids = tuple(artifact.artifact_id for artifact in artifacts)
        return output, (), artifact_ids, 1
