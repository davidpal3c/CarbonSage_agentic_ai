"""Deterministic conversion of typed tool results into validated response blocks."""

from __future__ import annotations

from domain.agent.models import (
    ActionBlock,
    AgentResponseEnvelope,
    ArtifactReferenceBlock,
    ChartBlock,
    ChartKind,
    ChartSeries,
    CitationRecord,
    EvidenceStatus,
    EvidenceSupportAssessment,
    MetricBlock,
    ResponseBlock,
    TableBlock,
    TableColumn,
    TextBlock,
    WarningBlock,
)
from domain.agent.tools import (
    BuildDecisionReportOutput,
    CalculateFreightEmissionsOutput,
    CompareTransportScenariosOutput,
    GetCitationContextOutput,
    ListWorkspaceArtifactsOutput,
    SearchSupplierEvidenceOutput,
    SummarizeDataQualityOutput,
)
from services.agent_tools import ToolExecution


def _chart(
    *,
    title: str,
    x_key: str,
    rows: list[dict[str, str | int | float]],
    series: list[ChartSeries],
    columns: list[TableColumn],
) -> ChartBlock:
    table = TableBlock(
        title=title,
        columns=columns,
        rows=rows,
        caption="Table equivalent for the chart values.",
    )
    return ChartBlock(
        chart_kind=ChartKind.BAR,
        title=title,
        x_key=x_key,
        series=series,
        rows=rows,
        table_fallback=table,
    )


def compose_agent_response(
    executions: tuple[ToolExecution, ...],
    *,
    processing_time_ms: int,
    evidence_support: EvidenceSupportAssessment | None = None,
) -> tuple[AgentResponseEnvelope, tuple[CitationRecord, ...]]:
    blocks: list[ResponseBlock] = []
    citations_by_identity: dict[tuple[str, int], CitationRecord] = {}
    approved_citation_ids = set(evidence_support.citation_ids if evidence_support else ())
    evidence_attempted = False
    workspace_empty = False

    for execution in executions:
        if execution.error_message:
            blocks.append(
                WarningBlock(
                    code=execution.event.error_code or "tool_error",
                    message=execution.error_message,
                )
            )
            continue

        output = execution.output
        if isinstance(output, ListWorkspaceArtifactsOutput):
            blocks.append(
                TextBlock(
                    text=(
                        f"This workspace has {len(output.artifacts)} active artifact"
                        f"{'s' if len(output.artifacts) != 1 else ''}."
                    )
                )
            )
            if not output.artifacts:
                workspace_empty = True
                blocks.append(
                    WarningBlock(
                        code="no_artifacts",
                        message=(
                            "No supplier or shipment data is available in this workspace yet."
                        ),
                    )
                )
            for artifact in output.artifacts[:6]:
                blocks.append(
                    ArtifactReferenceBlock(
                        artifact_id=artifact.artifact_id,
                        title=artifact.title,
                        artifact_kind=artifact.kind,
                    )
                )
        elif isinstance(output, SearchSupplierEvidenceOutput):
            evidence_attempted = True
            supported_matches = [
                match
                for match in output.matches
                if match.citation.citation_id in approved_citation_ids
            ]
            if supported_matches:
                blocks.append(
                    TextBlock(
                        text=(
                            "The evidence-support check found "
                            f"{len(supported_matches)} {output.mode_used} passage"
                            f"{'s' if len(supported_matches) != 1 else ''} that directly "
                            "support this request."
                        )
                    )
                )
                for match in supported_matches:
                    citation = match.citation
                    citations_by_identity.setdefault(
                        (citation.artifact_id, citation.chunk_index),
                        citation,
                    )
                    blocks.append(citation.to_block())
            else:
                blocks.append(
                    WarningBlock(
                        code="evidence_limit",
                        message=(
                            "The workspace evidence does not support a reliable answer to this "
                            "question. CarbonSage will not invent a citation."
                        ),
                    )
                )
            if output.warning:
                blocks.append(WarningBlock(code="retrieval_fallback", message=output.warning))
        elif isinstance(output, GetCitationContextOutput):
            evidence_attempted = True
            if output.citation.citation_id in approved_citation_ids:
                citation = output.citation
                citations_by_identity.setdefault(
                    (citation.artifact_id, citation.chunk_index),
                    citation,
                )
                blocks.append(
                    TextBlock(text=f"Validated citation context for {output.supplier_name}.")
                )
                blocks.append(citation.to_block())
            else:
                blocks.append(
                    WarningBlock(
                        code="evidence_limit",
                        message=(
                            "The cited context does not directly support a reliable answer "
                            "to this question. CarbonSage will not overstate it."
                        ),
                    )
                )
        elif isinstance(output, CalculateFreightEmissionsOutput):
            blocks.extend(
                (
                    TextBlock(
                        text=(
                            "The estimate below comes from CarbonSage's validated freight "
                            "calculation, not model-generated arithmetic."
                        )
                    ),
                    MetricBlock(
                        label=f"{output.transport_method.title()} emissions",
                        value=output.emissions_kg,
                        unit="kg CO2e",
                        context=(
                            f"{output.weight_kg:g} kg over {output.distance_km:g} km · "
                            f"{output.provenance.version}"
                        ),
                    ),
                )
            )
            for warning in output.provenance.warnings:
                blocks.append(WarningBlock(code="calculation_warning", message=warning))
        elif isinstance(output, CompareTransportScenariosOutput):
            rows = [
                {
                    "scenario": "Current baseline",
                    "emissions_kg": output.baseline_total_kg,
                },
                {
                    "scenario": output.alternative_mode.title(),
                    "emissions_kg": output.alternative_total_kg,
                },
            ]
            blocks.extend(
                (
                    TextBlock(
                        text=(
                            f"Compared {output.shipment_count} validated shipment"
                            f"{'s' if output.shipment_count != 1 else ''} against "
                            f"{output.alternative_mode}."
                        )
                    ),
                    MetricBlock(
                        label="Scenario change",
                        value=output.delta_kg,
                        unit="kg CO2e",
                        context=(
                            f"{output.delta_percent:g}% versus baseline"
                            if output.delta_percent is not None
                            else "No percentage is available for a zero baseline."
                        ),
                    ),
                    _chart(
                        title="Baseline and alternative emissions",
                        x_key="scenario",
                        rows=rows,
                        series=[
                            ChartSeries(
                                key="emissions_kg",
                                label="Emissions",
                                unit="kg CO2e",
                            )
                        ],
                        columns=[
                            TableColumn(key="scenario", label="Scenario"),
                            TableColumn(
                                key="emissions_kg",
                                label="Emissions",
                                unit="kg CO2e",
                            ),
                        ],
                    ),
                )
            )
        elif isinstance(output, SummarizeDataQualityOutput):
            workspace_empty = (
                output.shipment_count == 0
                and output.supplier_count == 0
                and output.evidence_document_count == 0
            )
            blocks.extend(
                (
                    TextBlock(
                        text="Data-quality results use current normalized workspace records."
                    ),
                    MetricBlock(
                        label="Active shipments",
                        value=float(output.shipment_count),
                        unit="rows",
                    ),
                    MetricBlock(
                        label="Complete suppliers",
                        value=float(output.complete_supplier_count),
                        unit=f"of {output.supplier_count}",
                    ),
                )
            )
            for issue in output.issues:
                blocks.append(WarningBlock(code="data_quality_gap", message=issue.message))
        elif isinstance(output, BuildDecisionReportOutput):
            workspace_empty = output.shipment_count == 0 and output.supplier_count == 0
            blocks.extend(
                (
                    TextBlock(
                        text=(
                            "Built decision-report data from the same typed analysis used by "
                            "the workspace report endpoints."
                        )
                    ),
                    MetricBlock(
                        label="Total freight emissions",
                        value=output.total_emissions_kg,
                        unit="kg CO2e",
                        context=f"{output.shipment_count} shipments · {output.factor_version}",
                    ),
                )
            )
            if output.mode_rows:
                blocks.append(
                    _chart(
                        title="Emissions by transport mode",
                        x_key="mode",
                        rows=output.mode_rows,
                        series=[
                            ChartSeries(
                                key="emissions_kg",
                                label="Emissions",
                                unit="kg CO2e",
                            )
                        ],
                        columns=[
                            TableColumn(key="mode", label="Mode"),
                            TableColumn(key="shipment_count", label="Shipments"),
                            TableColumn(key="weight_kg", label="Weight", unit="kg"),
                            TableColumn(
                                key="emissions_kg",
                                label="Emissions",
                                unit="kg CO2e",
                            ),
                        ],
                    )
                )
            if output.shipment_count:
                blocks.append(
                    ActionBlock(
                        action_id="reports.save_snapshot",
                        label="Save report snapshot",
                        requires_confirmation=True,
                    )
                )
            for warning in output.warnings:
                blocks.append(WarningBlock(code="report_warning", message=warning))

    if workspace_empty:
        blocks.append(
            ActionBlock(
                action_id="workspace.load_demo_data",
                label="Load demo data",
                requires_confirmation=False,
            )
        )

    if not blocks:
        blocks.append(
            WarningBlock(
                code="unsupported_request",
                message=(
                    "This request is outside the approved CarbonSage tools or lacks enough "
                    "detail to run one safely."
                ),
            )
        )
    response_blocks = blocks[:30]
    visible_citation_ids = {
        block.citation_id for block in response_blocks if block.type == "citation"
    }
    citations = tuple(
        citation
        for citation in citations_by_identity.values()
        if citation.citation_id in visible_citation_ids
    )
    if citations:
        evidence_status = EvidenceStatus.SUPPORTED
    elif evidence_attempted:
        evidence_status = EvidenceStatus.LIMITED
    else:
        evidence_status = EvidenceStatus.NOT_REQUIRED
    return (
        AgentResponseEnvelope(
            evidence_status=evidence_status,
            blocks=response_blocks,
            processing_time_ms=processing_time_ms,
        ),
        citations,
    )
