export type ScalarValue = string | number | boolean | null;

export type TextBlock = {
  type: "text";
  text: string;
};

export type MetricBlock = {
  type: "metric";
  label: string;
  value: number;
  unit: string | null;
  context: string | null;
};

export type TableColumn = {
  key: string;
  label: string;
  unit: string | null;
};

export type TableBlock = {
  type: "table";
  title: string;
  columns: TableColumn[];
  rows: Array<Record<string, ScalarValue>>;
  caption: string | null;
};

export type ChartSeries = {
  key: string;
  label: string;
  unit: string | null;
};

export type ChartBlock = {
  type: "chart";
  chart_kind: "bar" | "line";
  title: string;
  x_key: string;
  series: ChartSeries[];
  rows: Array<Record<string, ScalarValue>>;
  table_fallback: TableBlock;
};

export type CitationBlock = {
  type: "citation";
  citation_id: string;
  artifact_id: string;
  filename: string;
  document_sha256: string;
  page_number: number | null;
  chunk_index: number;
  excerpt: string;
};

export type ArtifactReferenceBlock = {
  type: "artifact_reference";
  artifact_id: string;
  title: string;
  artifact_kind: string;
};

export type WarningBlock = {
  type: "warning";
  code: string;
  message: string;
};

export type ActionBlock = {
  type: "action";
  action_id: string;
  label: string;
  requires_confirmation: boolean;
  artifact_id: string | null;
};

export type ResponseBlock =
  | TextBlock
  | MetricBlock
  | TableBlock
  | ChartBlock
  | CitationBlock
  | ArtifactReferenceBlock
  | WarningBlock
  | ActionBlock;

export type AgentResponseEnvelope = {
  schema_version: "1.0";
  response_id: string;
  policy_version: "1.0";
  evidence_status: "supported" | "limited" | "not_required";
  blocks: ResponseBlock[];
  processing_time_ms: number;
  generated_at: string;
};

export type AgentMessage = {
  message_id: string;
  conversation_id: string;
  workspace_id: string;
  role: "user" | "assistant";
  content: string;
  response: AgentResponseEnvelope | null;
  created_at: string;
};

export type AgentConversation = {
  conversation_id: string;
  workspace_id: string;
  title: string;
  status: "active" | "closed";
  policy_version: "1.0";
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type ConversationListResponse = {
  conversations: AgentConversation[];
};

export type AgentToolEvent = {
  event_id: string;
  tool_name: string;
  status: "succeeded" | "failed";
  duration_ms: number;
  result_count: number;
  artifact_ids: string[];
  error_code: string | null;
};

export type ConversationDetailResponse = {
  conversation: AgentConversation;
  messages: AgentMessage[];
  tool_events: AgentToolEvent[];
};

export type MessageExchangeResponse = {
  user_message: AgentMessage;
  assistant_message: AgentMessage;
};

export type AgentHealth = {
  status: string;
  available: boolean;
  policy_version: string;
  response_schema_version: string;
};

export type AgentUsage = {
  questions_used: number;
  question_limit: number;
  questions_remaining: number;
  model_calls: number;
  spend_usd: number;
  spend_is_estimate: boolean;
  currency: "USD";
  resets_at: string;
};

export type AgentAvailability =
  | "checking"
  | "available"
  | "disabled"
  | "unreachable";

export type UiMessage = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  response?: AgentResponseEnvelope;
  isError?: boolean;
};

export type ApiError = {
  detail?: string;
};
