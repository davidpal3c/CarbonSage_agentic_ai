"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  FileText,
  Quote,
} from "lucide-react";

import { Spinner } from "@/app/components/Spinner";
import { StructuredDataChart } from "@/app/components/charts/CarbonCharts";
import type {
  ActionBlock,
  AgentResponseEnvelope,
  ArtifactReferenceBlock,
  ChartBlock,
  CitationBlock,
  MetricBlock,
  ResponseBlock,
  ScalarValue,
  SuggestionsBlock,
  TableBlock,
  TextBlock,
  WarningBlock,
} from "@/app/types/chat";

type StructuredResponseProps = {
  response: AgentResponseEnvelope;
  onAction?: (actionId: string, artifactId: string | null) => Promise<void>;
  onPrompt?: (prompt: string) => void | Promise<void>;
  promptDisabled?: boolean;
};

type UnknownBlock = Record<string, unknown>;

function formatValue(value: ScalarValue, unit?: string | null) {
  const displayed =
    typeof value === "number"
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(
          value,
        )
      : value === null
        ? "—"
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : value;
  return unit && displayed !== "—" ? `${displayed} ${unit}` : displayed;
}

function DataTable({ table }: { table: TableBlock }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-xs">
        <caption className={table.caption ? "px-3 py-2 text-left" : "sr-only"}>
          {table.caption ?? table.title}
        </caption>
        <thead className="border-y border-border bg-muted text-muted-foreground">
          <tr>
            {table.columns.map((column) => (
              <th
                scope="col"
                key={column.key}
                className="px-3 py-2 font-semibold"
              >
                {column.label}
                {column.unit ? ` (${column.unit})` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-0">
              {table.columns.map((column) => (
                <td key={column.key} className="px-3 py-2 text-primary">
                  {formatValue(row[column.key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chart({ block }: { block: ChartBlock }) {
  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 aria-hidden="true" className="h-5 w-5 text-accent" />
        <h4 className="font-semibold text-primary">{block.title}</h4>
      </div>
      <StructuredDataChart
        title={block.title}
        description={`${block.title}. Interactive ${block.chart_kind} chart. Values are also available in a table.`}
        kind={block.chart_kind}
        data={block.rows}
        xKey={block.x_key}
        series={block.series}
        height={Math.max(220, Math.min(340, block.rows.length * 34))}
      />
      <details className="mt-4 rounded-lg bg-muted px-3 py-2 text-primary">
        <summary className="cursor-pointer text-xs font-semibold">
          View chart data
        </summary>
        <div className="mt-3">
          <DataTable table={block.table_fallback} />
        </div>
      </details>
    </article>
  );
}

function Citation({ block }: { block: CitationBlock }) {
  return (
    <figure className="rounded-xl border-l-4 border-accent bg-background p-4">
      <div className="flex gap-3">
        <Quote
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
        />
        <div className="min-w-0">
          <blockquote className="text-sm leading-6 text-primary">
            {block.excerpt}
          </blockquote>
          <figcaption className="mt-2 break-words text-xs text-muted-foreground">
            {block.filename} · chunk {block.chunk_index}
            {block.page_number ? ` · page ${block.page_number}` : ""} · document{" "}
            {block.document_sha256.slice(0, 12)}…
          </figcaption>
        </div>
      </div>
    </figure>
  );
}

function Action({
  block,
  onAction,
}: {
  block: ActionBlock;
  onAction?: StructuredResponseProps["onAction"];
}) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">(
    "idle",
  );

  async function run() {
    if (!onAction) return;
    if (
      block.requires_confirmation &&
      !window.confirm(`Confirm action: ${block.label}?`)
    ) {
      return;
    }
    setStatus("running");
    try {
      await onAction(block.action_id, block.artifact_id);
      setStatus("done");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <button
        type="button"
        onClick={run}
        disabled={!onAction || status === "running" || status === "done"}
        className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "running" ? <Spinner /> : null}
        {status === "done" ? "Completed" : block.label}
      </button>
      {!onAction ? (
        <p className="mt-2 text-xs text-muted-foreground">
          This action is not enabled in the current host.
        </p>
      ) : null}
      {status === "failed" ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          The confirmed action could not be completed.
        </p>
      ) : null}
    </div>
  );
}

function isRecord(value: unknown): value is UnknownBlock {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function Block({
  value,
  onAction,
  onPrompt,
  promptDisabled,
}: {
  value: ResponseBlock | UnknownBlock;
  onAction?: StructuredResponseProps["onAction"];
  onPrompt?: StructuredResponseProps["onPrompt"];
  promptDisabled?: boolean;
}) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return (
      <p role="status" className="rounded-lg border border-border p-3 text-xs">
        Some response details could not be displayed.
      </p>
    );
  }

  switch (value.type) {
    case "text": {
      const block = value as TextBlock;
      return <p className="text-sm leading-6 text-primary">{block.text}</p>;
    }
    case "metric": {
      const block = value as MetricBlock;
      return (
        <article className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {block.label}
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {formatValue(block.value, block.unit)}
          </p>
          {block.context ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {block.context}
            </p>
          ) : null}
        </article>
      );
    }
    case "table": {
      const block = value as TableBlock;
      return (
        <article className="rounded-xl bg-background p-3">
          <h4 className="mb-3 font-semibold text-primary">{block.title}</h4>
          <DataTable table={block} />
        </article>
      );
    }
    case "chart":
      return <Chart block={value as ChartBlock} />;
    case "citation":
      return <Citation block={value as CitationBlock} />;
    case "artifact_reference": {
      const block = value as ArtifactReferenceBlock;
      return (
        <Link
          href={`/dashboard/artifacts?artifact=${encodeURIComponent(block.artifact_id)}`}
          className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:border-accent"
        >
          <FileText
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-accent"
          />
          <span className="min-w-0">
            <strong className="block break-words text-sm text-primary">
              {block.title}
            </strong>
            <span className="text-xs text-muted-foreground">
              {block.artifact_kind.replaceAll("_", " ")} ·{" "}
              {block.artifact_id.slice(0, 8)}
            </span>
          </span>
        </Link>
      );
    }
    case "warning": {
      const block = value as WarningBlock;
      return (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <p className="text-sm leading-5">{block.message}</p>
        </div>
      );
    }
    case "action":
      return <Action block={value as ActionBlock} onAction={onAction} />;
    case "suggestions": {
      const block = value as SuggestionsBlock;
      return (
        <section
          aria-label={block.title}
          className="rounded-xl border border-border bg-transparent p-4"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {block.title}
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {block.options.map((option) => (
              <button
                key={`${option.label}-${option.prompt}`}
                type="button"
                onClick={() => void onPrompt?.(option.prompt)}
                disabled={!onPrompt || promptDisabled}
                title={option.prompt}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-chat-surface px-3 py-2 text-left text-xs font-semibold text-primary shadow-sm transition hover:border-accent hover:text-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {option.label}
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </section>
      );
    }
    default:
      return (
        <p
          role="status"
          className="rounded-lg border border-border p-3 text-xs"
        >
          This response includes an item that cannot be displayed here yet.
        </p>
      );
  }
}

export default function StructuredResponse({
  response,
  onAction,
  onPrompt,
  promptDisabled,
}: StructuredResponseProps) {
  return (
    <div className="space-y-3">
      <p className="sr-only">
        Evidence status: {response.evidence_status.replaceAll("_", " ")}.
      </p>
      {response.blocks.map((block, index) => (
        <Block
          key={`${response.response_id}-${index}`}
          value={block}
          onAction={onAction}
          onPrompt={onPrompt}
          promptDisabled={promptDisabled}
        />
      ))}
    </div>
  );
}
