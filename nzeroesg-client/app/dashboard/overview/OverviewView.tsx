"use client";

import Link from "next/link";
import { ArrowUpRight, Database } from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/app/components/AnimatedNumber";
import { Spinner } from "@/app/components/Spinner";
import { ShipmentTrendChart } from "@/app/components/charts/CarbonCharts";
import type {
  Artifact,
  ShipmentAnalysis,
} from "@/app/dashboard/workspace-data-store";

const artifactKindLabels = {
  shipment_dataset: "Shipments",
  evidence_document: "Evidence",
  report_snapshot: "Report",
} as const;

const modeColor = (mode: string) =>
  ["plane", "truck", "train", "ship"].includes(mode)
    ? `var(--chart-${mode})`
    : "var(--chart-highlight)";

const decimals = (value: number, digits: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

type OverviewViewProps = {
  analysis: ShipmentAnalysis | null;
  /** The workspace holds at least one shipment. */
  hasData: boolean;
  isLoading: boolean;
  /** A failed shipment load; only shown while no data is held. */
  error: string | null;
  /** Source of the shipment data: the fictional demo set or a named upload. */
  source: { demo: boolean; title: string | null };
  artifacts: Artifact[];
  artifactsLoading: boolean;
  isLoadingDemoData: boolean;
  demoLoadError: string | null;
  onLoadDemoData: () => void;
  onRetry: () => void;
};

/** A ledger section: heavy top rule, eyebrow label, h2, optional action. */
function Panel({
  id,
  eyebrow,
  title,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="label-ui text-muted-foreground">{eyebrow}</p>
          <h2 id={id} className="mt-1 text-base font-semibold">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const panelLink =
  "inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-4 hover:underline";

function Placeholder({
  height,
  children,
}: {
  height: number;
  children: string;
}) {
  return (
    <div
      style={{ minHeight: height }}
      className="flex items-center justify-center border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

export default function OverviewView({
  analysis,
  hasData,
  isLoading,
  error,
  source,
  artifacts,
  artifactsLoading,
  isLoadingDemoData,
  demoLoadError,
  onLoadDemoData,
  onRetry,
}: OverviewViewProps) {
  const failed = Boolean(error) && !hasData && !isLoading;
  const isEmpty = !hasData && !isLoading && !failed;
  const unavailable = isLoading
    ? "Loading…"
    : failed
      ? "Unavailable until the data loads"
      : null;

  const modes = analysis
    ? Object.entries(analysis.mode_breakdown).sort(
        (left, right) => right[1].emissions_kg - left[1].emissions_kg,
      )
    : [];
  const total = analysis?.total_emissions_kg ?? 0;
  const hotspots = analysis?.hotspots.slice(0, 5) ?? [];
  const maxHotspot = hotspots[0]?.emissions_kg ?? 0;
  const leadMode = modes[0] ?? null;
  const leadSupplier = leadMode
    ? ([...leadMode[1].suppliers].sort(
        (left, right) => right.emissions_kg - left.emissions_kg,
      )[0] ?? null)
    : null;
  const recentArtifacts = [...artifacts]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    )
    .slice(0, 4);

  return (
    <div className="space-y-10" aria-busy={isLoading}>
      {isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading shipment data…
        </p>
      ) : null}

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
        >
          <div>
            <h2 className="font-bold">Shipment data could not be loaded</h2>
            <p className="mt-1 text-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-md border border-red-800 px-4 text-sm font-semibold text-red-800 hover:bg-red-800 hover:text-white dark:border-red-300 dark:text-red-200 dark:hover:bg-red-200 dark:hover:text-red-950"
          >
            Try again
          </button>
        </div>
      ) : null}

      {isEmpty ? (
        <section
          aria-labelledby="overview-empty"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4"
        >
          <div>
            <h2 id="overview-empty" className="font-bold">
              No shipment data yet
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Load the fictional dataset or import a CSV/XLSX workbook to
              populate the Overview. The sections below show what will become
              available.
            </p>
            {isLoadingDemoData ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                Loading the fictional demo dataset…
              </p>
            ) : null}
            {demoLoadError ? (
              <p
                role="alert"
                className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
              >
                {demoLoadError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onLoadDemoData}
              disabled={isLoadingDemoData}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-secondary px-4 text-sm font-semibold text-white transition-colors hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingDemoData ? (
                <Spinner />
              ) : (
                <Database aria-hidden="true" className="h-4 w-4" />
              )}
              Load demo data
            </button>
            <Link
              href="/dashboard/shipments"
              className="inline-flex min-h-11 items-center rounded-md border border-control px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Import shipments
            </Link>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="overview-baseline"
        className="rounded-lg border border-border bg-card p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-ui text-muted-foreground">Current baseline</p>
            <h2 id="overview-baseline" className="mt-1 text-base font-semibold">
              Carbon metrics
            </h2>
          </div>
          {hasData ? (
            <span className="label-ui rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
              {source.demo
                ? "Fictional demo dataset"
                : `Source: ${source.title ?? "uploaded shipments"}`}
            </span>
          ) : null}
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <dt className="text-sm text-muted-foreground">Total emissions</dt>
            <dd className="mt-1.5 whitespace-nowrap font-mono text-[clamp(2rem,3.6vw,2.75rem)] font-medium leading-none tracking-[-0.04em]">
              {hasData ? (
                <>
                  <AnimatedNumber value={total} maximumFractionDigits={1} />{" "}
                  <span className="text-base tracking-normal text-muted-foreground">
                    kg CO₂e
                  </span>
                </>
              ) : (
                <span aria-label="No data">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Shipments</dt>
            <dd className="mt-1.5 font-mono text-2xl font-medium">
              {hasData ? (
                <AnimatedNumber value={analysis?.shipment_count ?? 0} />
              ) : (
                <span aria-label="No data">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Freight weight</dt>
            <dd className="mt-1.5 font-mono text-2xl font-medium">
              {hasData ? (
                <>
                  <AnimatedNumber value={analysis?.total_weight_kg ?? 0} />{" "}
                  <span className="text-sm text-muted-foreground">kg</span>
                </>
              ) : (
                <span aria-label="No data">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Active artifacts</dt>
            <dd className="mt-1.5 font-mono text-2xl font-medium">
              <AnimatedNumber value={artifacts.length} />
            </dd>
          </div>
        </dl>

        {hasData && analysis ? (
          <p className="mt-6 max-w-[80ch] text-[13px] leading-5 text-muted-foreground">
            Calculated with the {analysis.factor_source} (
            {analysis.factor_version}). {analysis.factor_applicability} Totals
            combine each shipment&apos;s payload, route distance and transport
            intensity.
          </p>
        ) : null}
      </section>

      <Panel
        id="overview-trend"
        eyebrow="Emissions trajectory"
        title="Monthly freight footprint"
        action={
          <Link
            href="/dashboard/shipments"
            aria-label="Explore shipment analytics"
            className={panelLink}
          >
            Explore <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        }
      >
        {analysis && hasData ? (
          <>
            <ShipmentTrendChart
              analysis={analysis}
              variant="area"
              height={300}
            />
            <details className="mt-4 border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                View exact emissions values
              </summary>
              <div
                role="region"
                aria-label="Monthly emissions values by mode"
                tabIndex={0}
                className="mt-3 overflow-x-auto"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Period
                      </th>
                      {modes.map(([mode]) => (
                        <th
                          key={mode}
                          scope="col"
                          className="px-3 py-2 text-right font-medium capitalize"
                        >
                          {mode}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="py-2 pl-3 text-right font-medium"
                      >
                        Total kg CO₂e
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.timeline.map((period) => (
                      <tr
                        key={period.period}
                        className="border-t border-border"
                      >
                        <th scope="row" className="py-2 pr-4 font-normal">
                          {period.period}
                        </th>
                        {modes.map(([mode]) => (
                          <td
                            key={mode}
                            className="px-3 py-2 text-right font-mono tabular-nums"
                          >
                            {decimals(period.mode_emissions_kg[mode] ?? 0, 2)}
                          </td>
                        ))}
                        <td className="py-2 pl-3 text-right font-mono font-semibold tabular-nums">
                          {decimals(period.emissions_kg, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <Placeholder height={300}>
            {unavailable ?? "No emissions trend yet"}
          </Placeholder>
        )}
      </Panel>

      <div className="grid gap-x-10 gap-y-10 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Panel
            id="overview-mix"
            eyebrow="Mode distribution"
            title="Aggregate emissions mix"
          >
            {analysis && hasData ? (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Emissions, shipments and share of total by transport mode
                </caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Mode
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-right font-medium"
                    >
                      Shipments
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-right font-medium"
                    >
                      kg CO₂e
                    </th>
                    <th scope="col" className="py-2 pl-3 font-medium">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map(([mode, values]) => {
                    const share = total
                      ? (values.emissions_kg / total) * 100
                      : 0;
                    return (
                      <tr key={mode} className="border-t border-border">
                        <th
                          scope="row"
                          className="py-2.5 pr-3 text-left font-normal capitalize"
                        >
                          <span
                            aria-hidden="true"
                            className="mr-2 inline-block h-2.5 w-2.5 align-baseline"
                            style={{ background: modeColor(mode) }}
                          />
                          {mode}
                        </th>
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                          {values.shipment_count}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                          {decimals(values.emissions_kg, 1)}
                        </td>
                        <td className="min-w-24 py-2.5 pl-3">
                          <span className="font-mono tabular-nums">
                            {decimals(share, 1)}%
                          </span>
                          <span
                            aria-hidden="true"
                            className="mt-1 block h-1.5 bg-muted"
                          >
                            <span
                              className="block h-full"
                              style={{
                                width: `${share}%`,
                                background: modeColor(mode),
                              }}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Placeholder height={200}>
                {unavailable ?? "No mode distribution yet"}
              </Placeholder>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-7">
          <Panel
            id="overview-hotspots"
            eyebrow="Decision signals"
            title="Highest-impact shipments"
            action={
              <Link href="/dashboard/shipments" className={panelLink}>
                All shipments
              </Link>
            }
          >
            {analysis && hasData ? (
              <>
                {leadMode ? (
                  <p className="mb-3 text-sm text-muted-foreground">
                    <span className="capitalize">{leadMode[0]}</span> carries
                    the largest share of emissions
                    {leadSupplier?.supplier_name
                      ? `; leading supplier in that mode: ${leadSupplier.supplier_name}`
                      : ""}
                    .
                  </p>
                ) : null}
                <div
                  role="region"
                  aria-label="Highest-impact shipments"
                  tabIndex={0}
                  className="overflow-x-auto"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Shipment
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Route
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Mode
                        </th>
                        <th scope="col" className="py-2 pl-3 font-medium">
                          kg CO₂e
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspots.map((row) => (
                        <tr
                          key={row.shipment_id}
                          className="border-t border-border"
                        >
                          <th
                            scope="row"
                            className="py-2.5 pr-3 text-left font-mono text-[13px] font-medium"
                          >
                            {row.shipment_id}
                          </th>
                          <td className="px-3 py-2.5">
                            {row.origin} → {row.destination}
                          </td>
                          <td className="px-3 py-2.5 capitalize">
                            {row.transport_method}
                          </td>
                          <td className="min-w-28 py-2.5 pl-3">
                            <span className="font-mono tabular-nums">
                              {decimals(row.emissions_kg, 1)}
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-1 block h-1.5 bg-muted"
                            >
                              <span
                                className="block h-full"
                                style={{
                                  width: `${maxHotspot ? (row.emissions_kg / maxHotspot) * 100 : 0}%`,
                                  background: modeColor(row.transport_method),
                                }}
                              />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Placeholder height={200}>
                {unavailable ?? "No shipment hotspots yet"}
              </Placeholder>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        id="overview-artifacts"
        eyebrow="Workspace activity"
        title="Recent artifacts"
        action={
          <Link href="/dashboard/artifacts" className={panelLink}>
            View all
          </Link>
        }
      >
        {artifactsLoading && !recentArtifacts.length ? (
          <div className="flex min-h-24 items-center justify-center">
            <Spinner label="Loading artifacts" />
          </div>
        ) : recentArtifacts.length ? (
          <ul className="grid gap-x-10 lg:grid-cols-2">
            {recentArtifacts.map((artifact) => (
              <li key={artifact.artifact_id} className="border-t border-border">
                <Link
                  href={`/dashboard/artifacts?artifact=${artifact.artifact_id}`}
                  className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:text-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">
                      {artifact.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {artifactKindLabels[artifact.kind]} · version{" "}
                      {artifact.version}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder height={80}>No active artifacts yet.</Placeholder>
        )}
      </Panel>
    </div>
  );
}
