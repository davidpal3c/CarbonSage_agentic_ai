"""Workspace-scoped execution of CarbonSage's approved typed agent tools."""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date
from time import perf_counter

from pydantic import BaseModel, ValidationError

from domain.agent.models import CitationRecord, ToolEvent, ToolEventStatus
from domain.agent.tools import (
    TOOL_INPUT_MODELS,
    AgentToolName,
    AnalyzeShipmentEmissionsInput,
    AnalyzeShipmentEmissionsOutput,
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
    RecommendShipmentSupplierInput,
    RecommendShipmentSupplierOutput,
    ScenarioShipmentOutput,
    SearchSupplierEvidenceInput,
    SearchSupplierEvidenceOutput,
    ShipmentAnalyticsHotspotOutput,
    ShipmentAnalyticsModeOutput,
    ShipmentAnalyticsPeriodOutput,
    ShipmentAnalyticsSupplierOutput,
    ShipmentSupplierCandidateOutput,
    SummarizeDataQualityInput,
    SummarizeDataQualityOutput,
)
from domain.artifacts.models import ArtifactKind
from domain.emissions.calculator import calculate_emissions
from domain.emissions.modes import normalize_mode
from domain.emissions.units import normalize_weight_kg
from domain.evidence.models import EvidenceMatch
from domain.evidence.retrieval import RetrievalMode
from domain.scenarios.comparison import compare_shipment_modes
from domain.shipments.analysis import analyze_shipments
from domain.shipments.locations import (
    canonical_location_label,
    location_key,
    nearest_supported_origin,
)
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
        if tool_name is AgentToolName.ANALYZE_SHIPMENT_EMISSIONS:
            return self._shipment_analytics(
                workspace_id,
                AnalyzeShipmentEmissionsInput.model_validate(payload),
            )
        if tool_name is AgentToolName.RECOMMEND_SHIPMENT_SUPPLIER:
            return self._recommend_shipment_supplier(
                workspace_id,
                RecommendShipmentSupplierInput.model_validate(payload),
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

    def _shipment_analytics(
        self,
        workspace_id: str,
        payload: AnalyzeShipmentEmissionsInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        start_date = date.fromisoformat(payload.start_date) if payload.start_date else None
        end_date = date.fromisoformat(payload.end_date) if payload.end_date else None
        modes = tuple(
            dict.fromkeys(normalize_mode(mode).value for mode in payload.transport_methods)
        )
        analysis = analyze_shipments(
            self.shipment_repository.list_for_workspace(workspace_id),
            start_date=start_date,
            end_date=end_date,
            modes=modes,
            granularity=payload.granularity,
        )
        if len(analysis.timeline) > 20:
            raise ValueError(
                "The requested range has more than 20 chart periods. Narrow the date range "
                "or use yearly granularity."
            )
        output = AnalyzeShipmentEmissionsOutput(
            granularity=analysis.granularity,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            modes=list(analysis.selected_modes or analysis.mode_breakdown),
            shipment_count=analysis.shipment_count,
            workspace_shipment_count=analysis.workspace_shipment_count,
            filtered_out_count=analysis.filtered_out_count,
            undated_shipment_count=analysis.undated_shipment_count,
            total_weight_kg=analysis.total_weight_kg,
            total_emissions_kg=analysis.total_emissions_kg,
            mode_breakdown=[
                ShipmentAnalyticsModeOutput(
                    transport_method=mode,
                    shipment_count=breakdown.shipment_count,
                    weight_kg=breakdown.weight_kg,
                    emissions_kg=breakdown.emissions_kg,
                    suppliers=[
                        ShipmentAnalyticsSupplierOutput(
                            supplier_name=supplier.supplier_name,
                            shipment_count=supplier.shipment_count,
                            emissions_kg=supplier.emissions_kg,
                        )
                        for supplier in breakdown.suppliers
                    ],
                )
                for mode, breakdown in sorted(
                    analysis.mode_breakdown.items(),
                    key=lambda item: (-item[1].emissions_kg, item[0]),
                )
            ],
            periods=[
                ShipmentAnalyticsPeriodOutput(
                    period=period.period,
                    period_start=(period.period_start.isoformat() if period.period_start else None),
                    shipment_count=period.shipment_count,
                    weight_kg=period.weight_kg,
                    total_emissions_kg=period.emissions_kg,
                    plane_emissions_kg=period.mode_emissions_kg.get("plane", 0.0),
                    truck_emissions_kg=period.mode_emissions_kg.get("truck", 0.0),
                    train_emissions_kg=period.mode_emissions_kg.get("train", 0.0),
                    ship_emissions_kg=period.mode_emissions_kg.get("ship", 0.0),
                )
                for period in analysis.timeline
            ],
            hotspots=[
                ShipmentAnalyticsHotspotOutput(
                    shipment_id=hotspot.shipment_id,
                    shipment_date=(
                        hotspot.shipment_date.isoformat() if hotspot.shipment_date else None
                    ),
                    supplier_name=hotspot.supplier_name,
                    route=f"{hotspot.origin} to {hotspot.destination}",
                    transport_method=hotspot.transport_method,
                    emissions_kg=hotspot.emissions_kg,
                )
                for hotspot in analysis.hotspots[:5]
            ],
            factor_source=analysis.factor_source,
            factor_version=analysis.factor_version,
            warnings=list(analysis.warnings),
        )
        artifact_ids = tuple(
            artifact.artifact_id
            for artifact in self.artifact_repository.list_for_workspace(workspace_id)
            if artifact.kind is ArtifactKind.SHIPMENT_DATASET
        )
        return output, (), artifact_ids, analysis.shipment_count

    def _recommend_shipment_supplier(
        self,
        workspace_id: str,
        payload: RecommendShipmentSupplierInput,
    ) -> tuple[BaseModel, tuple[CitationRecord, ...], tuple[str, ...], int]:
        origin_key = location_key(payload.origin)
        destination_key = location_key(payload.destination)
        weight_kg = normalize_weight_kg(payload.weight_value, payload.weight_unit)
        workspace_shipments = list(self.shipment_repository.list_for_workspace(workspace_id))
        route_shipments = [
            shipment
            for shipment in workspace_shipments
            if location_key(shipment.origin) == origin_key
            and location_key(shipment.destination) == destination_key
        ]
        matched_origin = route_shipments[0].origin if route_shipments else None
        origin_distance_km: float | None = None
        canonical_origin = canonical_location_label(payload.origin)
        requested_words = re.sub(r"[^a-z0-9]+", " ", payload.origin.casefold()).strip()
        canonical_words = (
            re.sub(r"[^a-z0-9]+", " ", canonical_origin.casefold()).strip()
            if canonical_origin
            else None
        )
        origin_match = (
            "interpreted"
            if route_shipments
            and canonical_origin is not None
            and requested_words not in {origin_key, canonical_words}
            else "exact"
            if route_shipments
            else "none"
        )
        if not route_shipments and payload.allow_nearest_origin:
            supported_origins = [
                shipment.origin
                for shipment in workspace_shipments
                if shipment.supplier_name is not None
                and location_key(shipment.destination) == destination_key
            ]
            nearest = nearest_supported_origin(payload.origin, supported_origins)
            if nearest is not None:
                matched_origin, origin_distance_km = nearest
                matched_origin_key = location_key(matched_origin)
                route_shipments = [
                    shipment
                    for shipment in workspace_shipments
                    if location_key(shipment.origin) == matched_origin_key
                    and location_key(shipment.destination) == destination_key
                ]
                origin_match = "nearest_supported"
        linked_shipments = [
            shipment for shipment in route_shipments if shipment.supplier_name is not None
        ]
        candidate_options: list[ShipmentSupplierCandidateOutput] = []
        candidate_provenance: dict[tuple[str, str], tuple[str, str]] = {}
        for shipment in linked_shipments:
            assert shipment.supplier_name is not None
            result = calculate_emissions(
                weight_value=weight_kg,
                weight_unit="kg",
                distance_value=shipment.distance_km,
                distance_unit="km",
                mode=shipment.transport_method,
                distance_method="route",
                origin=payload.origin,
                destination=payload.destination,
            )
            candidate = ShipmentSupplierCandidateOutput(
                supplier_name=shipment.supplier_name,
                historical_shipment_id=shipment.shipment_id,
                transport_method=shipment.transport_method,
                distance_km=shipment.distance_km,
                estimated_emissions_kg=result.emissions_kg,
                estimated_cost_value=(
                    round(
                        shipment.freight_cost_value * weight_kg / shipment.weight_kg,
                        2,
                    )
                    if shipment.freight_cost_value is not None
                    and shipment.freight_cost_currency is not None
                    else None
                ),
                cost_currency=shipment.freight_cost_currency,
            )
            candidate_options.append(candidate)
            candidate_provenance[(shipment.supplier_name, shipment.shipment_id)] = (
                result.factor.source,
                result.factor.version,
            )

        warnings: list[str] = []
        cost_ranked = False
        if payload.objective == "carbon_and_cost" and candidate_options:
            priced_options = [
                candidate
                for candidate in candidate_options
                if candidate.estimated_cost_value is not None and candidate.cost_currency
            ]
            currencies = {candidate.cost_currency for candidate in priced_options}
            cost_ranked = bool(priced_options) and len(currencies) == 1
            if cost_ranked:
                min_emissions = min(
                    candidate.estimated_emissions_kg for candidate in priced_options
                )
                max_emissions = max(
                    candidate.estimated_emissions_kg for candidate in priced_options
                )
                min_cost = min(candidate.estimated_cost_value or 0 for candidate in priced_options)
                max_cost = max(candidate.estimated_cost_value or 0 for candidate in priced_options)

                def efficiency_score(candidate: ShipmentSupplierCandidateOutput) -> float:
                    emissions_range = max_emissions - min_emissions
                    cost_range = max_cost - min_cost
                    emissions_score = (
                        (candidate.estimated_emissions_kg - min_emissions) / emissions_range
                        if emissions_range
                        else 0.0
                    )
                    cost_score = (
                        ((candidate.estimated_cost_value or 0) - min_cost) / cost_range
                        if cost_range
                        else 0.0
                    )
                    return round(100 * (1 - ((emissions_score + cost_score) / 2)), 2)

                candidate_options = [
                    candidate.model_copy(update={"efficiency_score": efficiency_score(candidate)})
                    for candidate in priced_options
                ]
                if len(priced_options) != len(linked_shipments):
                    warnings.append(
                        "Some matching shipment options were excluded because comparable "
                        "historical freight cost was unavailable."
                    )
            else:
                warnings.append(
                    "Comparable historical freight cost is unavailable in one currency, so "
                    "CarbonSage ranked this lane by emissions only."
                )

        if cost_ranked:
            ranked_options = sorted(
                candidate_options,
                key=lambda candidate: (
                    -(candidate.efficiency_score or 0),
                    candidate.estimated_emissions_kg,
                    candidate.supplier_name.casefold(),
                ),
            )
        else:
            ranked_options = sorted(
                candidate_options,
                key=lambda candidate: (
                    candidate.estimated_emissions_kg,
                    candidate.supplier_name.casefold(),
                ),
            )
        candidates_by_supplier: dict[str, ShipmentSupplierCandidateOutput] = {}
        for candidate in ranked_options:
            candidates_by_supplier.setdefault(candidate.supplier_name, candidate)
        candidates = list(candidates_by_supplier.values())[:10]
        recommended = candidates[0] if candidates else None
        if not route_shipments:
            warnings.append(
                "No historical shipment matches this exact origin and destination, so "
                "CarbonSage cannot recommend a supplier without inventing route data."
            )
        elif not linked_shipments:
            warnings.append(
                "Matching shipments do not identify a supplier, so CarbonSage cannot make "
                "a supplier recommendation from this workspace."
            )
        elif len(linked_shipments) != len(route_shipments):
            warnings.append(
                "Some matching shipments were excluded because they do not identify a supplier."
            )
        if origin_match == "nearest_supported" and matched_origin is not None:
            warnings.append(
                "The recommendation uses the nearest supported historical origin. Any transfer "
                "from the requested city to that origin is outside this estimate."
            )

        provenance = (
            candidate_provenance[(recommended.supplier_name, recommended.historical_shipment_id)]
            if recommended is not None
            else None
        )
        output = RecommendShipmentSupplierOutput(
            origin=payload.origin,
            destination=payload.destination,
            matched_origin=matched_origin,
            origin_match=origin_match,
            origin_distance_km=origin_distance_km,
            weight_kg=weight_kg,
            recommended_supplier_name=(recommended.supplier_name if recommended else None),
            recommended_transport_method=(recommended.transport_method if recommended else None),
            recommended_emissions_kg=(recommended.estimated_emissions_kg if recommended else None),
            recommended_cost_value=(recommended.estimated_cost_value if recommended else None),
            cost_currency=(recommended.cost_currency if recommended else None),
            objective="carbon_and_cost" if cost_ranked else "carbon",
            candidates=candidates,
            basis=(
                (
                    "Equal-weight carbon-and-cost screening score among supplier-linked "
                    "historical shipments on the requested lane. Historical freight cost is "
                    "scaled linearly to the requested weight."
                    if cost_ranked
                    else "Lowest recalculated freight emissions among supplier-linked "
                    "historical shipments on the requested lane."
                )
                + " This is a screening comparison, not a live quote, capacity commitment, "
                "or procurement approval."
            ),
            factor_source=provenance[0] if provenance else None,
            factor_version=provenance[1] if provenance else None,
            warnings=warnings,
        )
        artifact_ids = tuple(
            artifact.artifact_id
            for artifact in self.artifact_repository.list_for_workspace(workspace_id)
            if artifact.kind is ArtifactKind.SHIPMENT_DATASET
        )
        return output, (), artifact_ids, len(candidates)

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
