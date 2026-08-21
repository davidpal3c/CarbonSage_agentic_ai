import {
  CheckCircle2,
  Clock3,
  FileText,
  MinusCircle,
  Wrench,
} from "lucide-react";

import { useArtifactViewer } from "@/app/dashboard/artifact-viewer-context";
import type {
  AgentAvailability,
  AgentConversation,
  AgentResponseEnvelope,
  AgentToolEvent,
  AgentUsage,
  ArtifactReferenceBlock,
  CitationBlock,
} from "@/app/types/chat";

type AgentDetailsPanelProps = {
  availability: AgentAvailability;
  conversation: AgentConversation | null;
  response: AgentResponseEnvelope | null;
  toolEvents: AgentToolEvent[];
  usage: AgentUsage | null;
  className?: string;
  showTitle?: boolean;
};

const evidenceLabels: Record<AgentResponseEnvelope["evidence_status"], string> =
  {
    supported: "Sources verified",
    limited: "More evidence needed",
    not_required: "No source needed",
  };

const toolLabels: Record<string, string> = {
  list_workspace_artifacts: "Reviewed workspace files",
  search_supplier_evidence: "Searched supplier evidence",
  get_citation_context: "Checked source context",
  calculate_freight_emissions: "Calculated freight emissions",
  compare_freight_scenarios: "Compared freight scenarios",
  compare_transport_scenarios: "Compared freight scenarios",
  analyze_shipment_emissions: "Analyzed shipment emissions",
  recommend_shipment_supplier: "Ranked supplier lane options",
  summarize_data_quality: "Reviewed data quality",
  build_decision_report: "Prepared report data",
};

function readableToolName(name: string) {
  return (
    toolLabels[name] ??
    name
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}

export default function AgentDetailsPanel({
  availability,
  conversation,
  response,
  toolEvents,
  usage,
  className = "",
  showTitle = true,
}: AgentDetailsPanelProps) {
  const { openArtifact } = useArtifactViewer();
  const citedSources = response
    ? response.blocks
        .filter((block): block is CitationBlock => block.type === "citation")
        .map((block) => ({
          artifactId: block.artifact_id,
          label: block.filename,
        }))
    : [];
  const referencedArtifacts = response
    ? response.blocks
        .filter(
          (block): block is ArtifactReferenceBlock =>
            block.type === "artifact_reference",
        )
        .map((block) => ({
          artifactId: block.artifact_id,
          label: block.title,
        }))
    : [];
  const sources = [...citedSources, ...referencedArtifacts].filter(
    (source, index, all) =>
      all.findIndex((item) => item.artifactId === source.artifactId) === index,
  );
  const recentEvents = toolEvents.slice(-6).reverse();

  return (
    <aside
      aria-label="Response details"
      className={`min-h-0 overflow-y-auto border-t border-border bg-muted/55 p-5 lg:border-l lg:border-t-0 ${className}`}
    >
      {showTitle ? (
        <h3 className="text-sm font-semibold text-primary">Response details</h3>
      ) : null}

      {availability === "disabled" ? (
        <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
          CarbonSage is not configured in this environment. Files, calculations,
          scenarios, and reports remain available.
        </p>
      ) : availability === "unreachable" ? (
        <p className="mt-3 rounded-xl border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
          CarbonSage could not be reached. Your workspace is still available.
        </p>
      ) : null}

      {response ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              {response.evidence_status === "supported" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="h-4 w-4 text-accent"
                />
              ) : (
                <MinusCircle aria-hidden="true" className="h-4 w-4" />
              )}
              Source coverage
            </dt>
            <dd className="mt-2 text-sm font-semibold text-primary">
              {evidenceLabels[response.evidence_status]}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 aria-hidden="true" className="h-4 w-4" />
              Response time
            </dt>
            <dd className="mt-2 text-sm font-semibold text-primary">
              {response.processing_time_ms < 1_000
                ? `${response.processing_time_ms} ms`
                : `${(response.processing_time_ms / 1_000).toFixed(1)} s`}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Source coverage and processing details will appear after a response.
        </p>
      )}

      {usage ? (
        <section className="mt-6" aria-labelledby="agent-usage-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h4
                id="agent-usage-title"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Today&apos;s AI use
              </h4>
              <p className="mt-2 text-sm font-semibold text-primary">
                {usage.questions_remaining} question
                {usage.questions_remaining === 1 ? "" : "s"} remaining
              </p>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {usage.questions_used} of {usage.question_limit} used
            </p>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label="Daily CarbonSage questions used"
            aria-valuemin={0}
            aria-valuemax={usage.question_limit}
            aria-valuenow={usage.questions_used}
          >
            <span
              className="block h-full rounded-full bg-accent transition-[width]"
              style={{
                width: `${Math.min(100, (usage.questions_used / usage.question_limit) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {usage.spend_is_estimate ? "Estimated spend" : "Provider spend"}
            </span>
            <strong className="font-semibold text-primary">
              {usage.spend_usd > 0 && usage.spend_usd < 0.01
                ? "<$0.01 USD"
                : `$${usage.spend_usd.toFixed(2)} USD`}
            </strong>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            Resets daily at 00:00 UTC. Deterministic answers may use no paid
            model call.
          </p>
        </section>
      ) : null}

      {sources.length ? (
        <section className="mt-6" aria-labelledby="agent-sources-title">
          <h4
            id="agent-sources-title"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            Sources
          </h4>
          <ul className="mt-3 space-y-2">
            {sources.map((source, index) => (
              <li key={`${source.artifactId}-${index}`}>
                <button
                  type="button"
                  onClick={() => openArtifact(source.artifactId, source.label)}
                  className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-primary transition hover:border-accent hover:bg-card"
                >
                  {source.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="agent-work-title">
        <h4
          id="agent-work-title"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          <Wrench aria-hidden="true" className="h-4 w-4" />
          Recent work
        </h4>
        {recentEvents.length ? (
          <ul className="mt-3 space-y-2">
            {recentEvents.map((event) => (
              <li
                key={event.event_id}
                className="rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-primary">
                    {readableToolName(event.tool_name)}
                  </span>
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      event.status === "succeeded" ? "bg-accent" : "bg-red-500"
                    }`}
                    aria-label={event.status}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.duration_ms} ms
                  {event.result_count
                    ? ` · ${event.result_count} result${event.result_count === 1 ? "" : "s"}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            No agent activity in this conversation yet.
          </p>
        )}
      </section>

      {conversation ? (
        <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          Conversation available until{" "}
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(conversation.expires_at))}
          .
        </p>
      ) : null}
    </aside>
  );
}
