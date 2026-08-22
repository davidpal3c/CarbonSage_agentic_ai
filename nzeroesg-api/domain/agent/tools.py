"""Approved typed tool inputs and outputs for the CarbonSage agent."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import Field, model_validator

from domain.agent.models import CitationRecord, StrictModel

TransportMode = Literal["plane", "air", "truck", "train", "ship", "ocean container"]
DistanceMethod = Literal["route", "straight_line"]


class AgentToolName(StrEnum):
    LIST_WORKSPACE_ARTIFACTS = "list_workspace_artifacts"
    SEARCH_SUPPLIER_EVIDENCE = "search_supplier_evidence"
    GET_CITATION_CONTEXT = "get_citation_context"
    CALCULATE_FREIGHT_EMISSIONS = "calculate_freight_emissions"
    ANALYZE_SHIPMENT_EMISSIONS = "analyze_shipment_emissions"
    RECOMMEND_SHIPMENT_SUPPLIER = "recommend_shipment_supplier"
    COMPARE_TRANSPORT_SCENARIOS = "compare_transport_scenarios"
    SUMMARIZE_DATA_QUALITY = "summarize_data_quality"
    BUILD_DECISION_REPORT = "build_decision_report"


class NoArguments(StrictModel):
    pass


class ListWorkspaceArtifactsInput(NoArguments):
    pass


class SearchSupplierEvidenceInput(StrictModel):
    query: str = Field(min_length=2, max_length=200)
    mode: Literal["lexical", "hybrid"] = "hybrid"
    limit: int = Field(default=5, ge=1, le=5)


class GetCitationContextInput(StrictModel):
    artifact_id: str
    chunk_index: int = Field(ge=0)


class CalculateFreightEmissionsInput(StrictModel):
    weight_value: float = Field(gt=0)
    weight_unit: Literal["g", "kg", "lb", "mt"] = "kg"
    distance_value: float = Field(gt=0)
    distance_unit: Literal["m", "km", "mi"] = "km"
    transport_method: TransportMode
    distance_method: DistanceMethod = "route"
    origin: str | None = Field(default=None, max_length=160)
    destination: str | None = Field(default=None, max_length=160)


class CompareTransportScenariosInput(StrictModel):
    alternative_transport_method: TransportMode


class AnalyzeShipmentEmissionsInput(StrictModel):
    granularity: Literal["month", "year"] = "month"
    start_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    transport_methods: list[TransportMode] = Field(default_factory=list, max_length=4)


class RecommendShipmentSupplierInput(StrictModel):
    origin: str = Field(min_length=2, max_length=160)
    destination: str = Field(min_length=2, max_length=160)
    weight_value: float = Field(gt=0)
    weight_unit: Literal["g", "kg", "lb", "mt"] = "kg"
    objective: Literal["carbon", "carbon_and_cost"] = "carbon"
    allow_nearest_origin: bool = False


class SummarizeDataQualityInput(NoArguments):
    pass


class BuildDecisionReportInput(StrictModel):
    alternative_transport_method: TransportMode | None = None


ToolArguments = (
    ListWorkspaceArtifactsInput
    | SearchSupplierEvidenceInput
    | GetCitationContextInput
    | CalculateFreightEmissionsInput
    | AnalyzeShipmentEmissionsInput
    | RecommendShipmentSupplierInput
    | CompareTransportScenariosInput
    | SummarizeDataQualityInput
    | BuildDecisionReportInput
)


class ArtifactToolItem(StrictModel):
    artifact_id: str
    title: str
    kind: str
    status: str
    source_type: str
    created_at: str


class ListWorkspaceArtifactsOutput(StrictModel):
    artifacts: list[ArtifactToolItem]


class EvidenceToolMatch(StrictModel):
    supplier_name: str
    excerpt: str
    retrieval_mode: str
    score: float | None
    citation: CitationRecord


class SearchSupplierEvidenceOutput(StrictModel):
    query: str
    requested_mode: str
    mode_used: str
    semantic_available: bool
    warning: str | None
    matches: list[EvidenceToolMatch]


class GetCitationContextOutput(StrictModel):
    citation: CitationRecord
    supplier_name: str


class CalculationProvenance(StrictModel):
    source: str
    version: str
    factor_kg_co2e_per_tonne_km: float
    distance_method: str
    assumptions: list[str]
    warnings: list[str]


class CalculateFreightEmissionsOutput(StrictModel):
    transport_method: str
    emissions_kg: float
    emissions_tonnes: float
    weight_kg: float
    distance_km: float
    provenance: CalculationProvenance


class ScenarioShipmentOutput(StrictModel):
    shipment_id: str
    origin: str
    destination: str
    baseline_mode: str
    alternative_mode: str
    baseline_emissions_kg: float
    alternative_emissions_kg: float
    delta_kg: float


class CompareTransportScenariosOutput(StrictModel):
    baseline_mode: str
    alternative_mode: str
    shipment_count: int
    baseline_total_kg: float
    alternative_total_kg: float
    delta_kg: float
    delta_percent: float | None
    shipment_results: list[ScenarioShipmentOutput]
    factor_source: str
    factor_version: str
    assumptions: list[str]


class ShipmentAnalyticsPeriodOutput(StrictModel):
    period: str
    period_start: str | None
    shipment_count: int
    weight_kg: float
    total_emissions_kg: float
    plane_emissions_kg: float
    truck_emissions_kg: float
    train_emissions_kg: float
    ship_emissions_kg: float


class ShipmentAnalyticsHotspotOutput(StrictModel):
    shipment_id: str
    shipment_date: str | None
    supplier_name: str | None
    route: str
    transport_method: str
    emissions_kg: float


class ShipmentAnalyticsSupplierOutput(StrictModel):
    supplier_name: str | None
    shipment_count: int
    emissions_kg: float


class ShipmentAnalyticsModeOutput(StrictModel):
    transport_method: str
    shipment_count: int
    weight_kg: float
    emissions_kg: float
    suppliers: list[ShipmentAnalyticsSupplierOutput]


class AnalyzeShipmentEmissionsOutput(StrictModel):
    granularity: Literal["month", "year"]
    start_date: str | None
    end_date: str | None
    modes: list[str]
    shipment_count: int
    workspace_shipment_count: int
    filtered_out_count: int
    undated_shipment_count: int
    total_weight_kg: float
    total_emissions_kg: float
    mode_breakdown: list[ShipmentAnalyticsModeOutput]
    periods: list[ShipmentAnalyticsPeriodOutput]
    hotspots: list[ShipmentAnalyticsHotspotOutput]
    factor_source: str
    factor_version: str
    warnings: list[str]


class ShipmentSupplierCandidateOutput(StrictModel):
    supplier_name: str
    historical_shipment_id: str
    transport_method: str
    distance_km: float
    estimated_emissions_kg: float
    estimated_cost_value: float | None = None
    cost_currency: str | None = None
    efficiency_score: float | None = None


class RecommendShipmentSupplierOutput(StrictModel):
    origin: str
    destination: str
    matched_origin: str | None = None
    origin_match: Literal["exact", "interpreted", "nearest_supported", "none"] = "none"
    origin_distance_km: float | None = None
    weight_kg: float
    recommended_supplier_name: str | None
    recommended_transport_method: str | None
    recommended_emissions_kg: float | None
    recommended_cost_value: float | None
    cost_currency: str | None
    objective: Literal["carbon", "carbon_and_cost"]
    candidates: list[ShipmentSupplierCandidateOutput]
    basis: str
    factor_source: str | None
    factor_version: str | None
    warnings: list[str]


class DataQualityIssue(StrictModel):
    area: str
    severity: Literal["info", "warning"]
    message: str


class SummarizeDataQualityOutput(StrictModel):
    shipment_count: int
    supplier_count: int
    evidence_document_count: int
    complete_supplier_count: int
    issues: list[DataQualityIssue]


class BuildDecisionReportOutput(StrictModel):
    shipment_count: int
    total_emissions_kg: float
    total_emissions_tonnes: float
    supplier_count: int
    mode_rows: list[dict[str, str | int | float]]
    scenario: CompareTransportScenariosOutput | None
    factor_source: str
    factor_version: str
    warnings: list[str]


class PlannedToolCall(StrictModel):
    call_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    tool_name: AgentToolName
    arguments: ToolArguments


class AgentPlan(StrictModel):
    calls: list[PlannedToolCall] = Field(max_length=3)

    @model_validator(mode="after")
    def validate_call_ids(self) -> AgentPlan:
        call_ids = [call.call_id for call in self.calls]
        if len(call_ids) != len(set(call_ids)):
            raise ValueError("Agent tool call ids must be unique.")
        return self


TOOL_INPUT_MODELS = {
    AgentToolName.LIST_WORKSPACE_ARTIFACTS: ListWorkspaceArtifactsInput,
    AgentToolName.SEARCH_SUPPLIER_EVIDENCE: SearchSupplierEvidenceInput,
    AgentToolName.GET_CITATION_CONTEXT: GetCitationContextInput,
    AgentToolName.CALCULATE_FREIGHT_EMISSIONS: CalculateFreightEmissionsInput,
    AgentToolName.ANALYZE_SHIPMENT_EMISSIONS: AnalyzeShipmentEmissionsInput,
    AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER: RecommendShipmentSupplierInput,
    AgentToolName.COMPARE_TRANSPORT_SCENARIOS: CompareTransportScenariosInput,
    AgentToolName.SUMMARIZE_DATA_QUALITY: SummarizeDataQualityInput,
    AgentToolName.BUILD_DECISION_REPORT: BuildDecisionReportInput,
}
