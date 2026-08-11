"""Versioned conversation and structured-response contracts for CarbonSage."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

AGENT_RESPONSE_SCHEMA_VERSION = "1.0"
AGENT_POLICY_VERSION = "1.0"

ScalarValue = str | int | float | bool | None


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EvidenceStatus(StrEnum):
    SUPPORTED = "supported"
    LIMITED = "limited"
    NOT_REQUIRED = "not_required"


class EvidenceSupportAssessment(StrictModel):
    status: Literal["supported", "limited"]
    citation_ids: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def validate_support(self) -> EvidenceSupportAssessment:
        if len(self.citation_ids) != len(set(self.citation_ids)):
            raise ValueError("Evidence-support citation ids must be unique.")
        if self.status == "supported" and not self.citation_ids:
            raise ValueError("Supported evidence requires at least one citation id.")
        if self.status == "limited" and self.citation_ids:
            raise ValueError("Limited evidence cannot approve citation ids.")
        return self


class ConversationStatus(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class ToolEventStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ChartKind(StrEnum):
    BAR = "bar"
    LINE = "line"


class TextBlock(StrictModel):
    type: Literal["text"] = "text"
    text: str = Field(min_length=1, max_length=4_000)


class MetricBlock(StrictModel):
    type: Literal["metric"] = "metric"
    label: str = Field(min_length=1, max_length=120)
    value: float
    unit: str | None = Field(default=None, max_length=40)
    context: str | None = Field(default=None, max_length=240)


class TableColumn(StrictModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=120)
    unit: str | None = Field(default=None, max_length=40)


class TableBlock(StrictModel):
    type: Literal["table"] = "table"
    title: str = Field(min_length=1, max_length=180)
    columns: list[TableColumn] = Field(min_length=1, max_length=12)
    rows: list[dict[str, ScalarValue]] = Field(max_length=50)
    caption: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def validate_rows(self) -> TableBlock:
        keys = {column.key for column in self.columns}
        if len(keys) != len(self.columns):
            raise ValueError("Table column keys must be unique.")
        for row in self.rows:
            if not set(row).issubset(keys):
                raise ValueError("Table rows may only contain declared column keys.")
        return self


class ChartSeries(StrictModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=120)
    unit: str | None = Field(default=None, max_length=40)


class ChartBlock(StrictModel):
    type: Literal["chart"] = "chart"
    chart_kind: ChartKind
    title: str = Field(min_length=1, max_length=180)
    x_key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    series: list[ChartSeries] = Field(min_length=1, max_length=4)
    rows: list[dict[str, ScalarValue]] = Field(min_length=1, max_length=20)
    table_fallback: TableBlock

    @model_validator(mode="after")
    def validate_chart_contract(self) -> ChartBlock:
        series_keys = {series.key for series in self.series}
        if self.x_key in series_keys or len(series_keys) != len(self.series):
            raise ValueError("Chart axis and series keys must be unique.")
        required = series_keys | {self.x_key}
        for row in self.rows:
            if not required.issubset(row):
                raise ValueError("Every chart row must include the x axis and all series values.")
            for key in series_keys:
                value = row[key]
                if isinstance(value, bool) or not isinstance(value, int | float):
                    raise ValueError("Chart series values must be numeric.")
        fallback_keys = {column.key for column in self.table_fallback.columns}
        if not required.issubset(fallback_keys):
            raise ValueError("The chart table fallback must expose every plotted value.")
        if self.table_fallback.rows != self.rows:
            raise ValueError("The chart and its table fallback must use identical rows.")
        return self


class CitationBlock(StrictModel):
    type: Literal["citation"] = "citation"
    citation_id: str
    artifact_id: str
    filename: str = Field(min_length=1, max_length=255)
    document_sha256: str = Field(min_length=64, max_length=64)
    page_number: int | None = Field(default=None, ge=1)
    chunk_index: int = Field(ge=0)
    excerpt: str = Field(min_length=1, max_length=2_000)


class ArtifactReferenceBlock(StrictModel):
    type: Literal["artifact_reference"] = "artifact_reference"
    artifact_id: str
    title: str = Field(min_length=1, max_length=255)
    artifact_kind: str = Field(min_length=1, max_length=40)


class WarningBlock(StrictModel):
    type: Literal["warning"] = "warning"
    code: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    message: str = Field(min_length=1, max_length=500)


class ActionBlock(StrictModel):
    type: Literal["action"] = "action"
    action_id: str = Field(pattern=r"^[a-z][a-z0-9_.-]{0,79}$")
    label: str = Field(min_length=1, max_length=120)
    requires_confirmation: bool = True
    artifact_id: str | None = None


ResponseBlock = Annotated[
    TextBlock
    | MetricBlock
    | TableBlock
    | ChartBlock
    | CitationBlock
    | ArtifactReferenceBlock
    | WarningBlock
    | ActionBlock,
    Field(discriminator="type"),
]


class AgentResponseEnvelope(StrictModel):
    schema_version: Literal["1.0"] = AGENT_RESPONSE_SCHEMA_VERSION
    response_id: str = Field(default_factory=lambda: str(uuid4()))
    policy_version: Literal["1.0"] = AGENT_POLICY_VERSION
    evidence_status: EvidenceStatus
    blocks: list[ResponseBlock] = Field(min_length=1, max_length=30)
    processing_time_ms: int = Field(ge=0)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def validate_evidence_status(self) -> AgentResponseEnvelope:
        has_citation = any(block.type == "citation" for block in self.blocks)
        if self.evidence_status is EvidenceStatus.SUPPORTED and not has_citation:
            raise ValueError("Supported responses require at least one citation block.")
        if self.evidence_status is not EvidenceStatus.SUPPORTED and has_citation:
            raise ValueError("Citation blocks require a supported evidence status.")
        return self


class CitationRecord(StrictModel):
    citation_id: str = Field(default_factory=lambda: str(uuid4()))
    artifact_id: str
    filename: str = Field(min_length=1, max_length=255)
    document_sha256: str = Field(min_length=64, max_length=64)
    page_number: int | None = Field(default=None, ge=1)
    chunk_index: int = Field(ge=0)
    excerpt: str = Field(min_length=1, max_length=2_000)

    def to_block(self) -> CitationBlock:
        return CitationBlock(type="citation", **self.model_dump())


class ToolEvent(StrictModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    tool_name: str = Field(min_length=1, max_length=80)
    status: ToolEventStatus
    duration_ms: int = Field(ge=0)
    result_count: int = Field(default=0, ge=0)
    artifact_ids: list[str] = Field(default_factory=list, max_length=20)
    error_code: str | None = Field(default=None, max_length=80)


class AgentConversation(StrictModel):
    conversation_id: str = Field(default_factory=lambda: str(uuid4()))
    workspace_id: str
    title: str = Field(min_length=1, max_length=160)
    status: ConversationStatus = ConversationStatus.ACTIVE
    policy_version: Literal["1.0"] = AGENT_POLICY_VERSION
    created_by: str = Field(min_length=1, max_length=160)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime

    @model_validator(mode="after")
    def validate_expiry(self) -> AgentConversation:
        if self.expires_at.tzinfo is None:
            raise ValueError("Conversation expiry must be timezone-aware.")
        if self.expires_at <= self.created_at:
            raise ValueError("Conversation expiry must follow creation.")
        return self


class AgentMessage(StrictModel):
    message_id: str = Field(default_factory=lambda: str(uuid4()))
    conversation_id: str
    workspace_id: str
    role: MessageRole
    content: str = Field(min_length=1, max_length=4_000)
    response: AgentResponseEnvelope | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @model_validator(mode="after")
    def validate_role_payload(self) -> AgentMessage:
        if self.role is MessageRole.USER and self.response is not None:
            raise ValueError("User messages cannot contain an agent response envelope.")
        if self.role is MessageRole.ASSISTANT and self.response is None:
            raise ValueError("Assistant messages require a validated response envelope.")
        return self


class ConversationDetail(StrictModel):
    conversation: AgentConversation
    messages: list[AgentMessage]
    tool_events: list[ToolEvent]
