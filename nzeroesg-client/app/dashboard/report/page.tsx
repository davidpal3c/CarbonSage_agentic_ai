"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { LoadingState, Spinner } from "@/app/components/Spinner";
import { useWorkspaceDataStore } from "@/app/dashboard/workspace-data-store";
import {
  buttonPrimary,
  buttonSecondary,
  Card,
  MetricStrip,
  PageHeader,
  WorkspacePage,
} from "@/app/dashboard/workspace-ui";

const alternatives = ["plane", "truck", "train", "ship"] as const;

export default function ReportPage() {
  const [alternativeMode, setAlternativeMode] = useState("train");
  const report = useWorkspaceDataStore(
    (state) => state.reports[alternativeMode] ?? null,
  );
  const reportStatus = useWorkspaceDataStore(
    (state) => state.reportStatuses[alternativeMode] ?? "idle",
  );
  const reportError = useWorkspaceDataStore(
    (state) => state.reportErrors[alternativeMode] ?? null,
  );
  const ensureReport = useWorkspaceDataStore((state) => state.ensureReport);
  const refreshAfterReportSnapshot = useWorkspaceDataStore(
    (state) => state.refreshAfterReportSnapshot,
  );
  const loadWorkspaceDemoData = useWorkspaceDataStore(
    (state) => state.loadDemoData,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDemoData, setIsLoadingDemoData] = useState(false);
  const isLoading = reportStatus === "loading";
  const error = actionError ?? reportError;
  const canLoadDemoData = Boolean(
    error?.includes(
      "Upload at least one valid shipment before running a scenario.",
    ),
  );

  useEffect(() => {
    void ensureReport(alternativeMode).catch(() => undefined);
  }, [alternativeMode, ensureReport]);

  async function refreshReport() {
    setActionError(null);
    setStatusMessage(null);
    try {
      await ensureReport(alternativeMode, true);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "The report preview could not be loaded.",
      );
    }
  }

  async function exportReport() {
    setIsExporting(true);
    setActionError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/reports/export.csv?alternative_mode=${encodeURIComponent(alternativeMode)}`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Report export could not be completed.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "carbonsage-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Report export could not be completed.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function saveSnapshot() {
    setIsSaving(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(`${getBackendUrl()}/reports/snapshots`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alternative_mode: alternativeMode }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(
          payload?.detail ?? "Report snapshot could not be saved.",
        );
      }
      const payload = (await response.json()) as {
        artifact: { title: string };
      };
      await refreshAfterReportSnapshot();
      setStatusMessage(`Saved ${payload.artifact.title}.`);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Report snapshot could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function loadDemoData() {
    setIsLoadingDemoData(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      await loadWorkspaceDemoData();
      await ensureReport(alternativeMode, true);
      setStatusMessage(
        "Demo data loaded. The report now uses the seeded baseline.",
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Demo data could not be loaded.",
      );
    } finally {
      setIsLoadingDemoData(false);
    }
  }

  const modes = report
    ? Object.entries(report.shipment_analysis.mode_breakdown)
    : [];

  return (
    <WorkspacePage>
      <PageHeader
        title="Report"
        description="Review the current results, save a snapshot, or export the data."
      />

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="flex min-w-56 max-w-sm flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Report alternative
          <select
            value={alternativeMode}
            onChange={(event) => {
              setActionError(null);
              setAlternativeMode(event.target.value);
            }}
            className="min-h-10 rounded-md border border-border bg-background px-3 text-sm font-normal capitalize text-primary lg:min-h-9"
          >
            {alternatives.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={refreshReport}
          disabled={isLoading}
          className={buttonPrimary}
        >
          {isLoading ? <Spinner /> : null}
          Refresh report
        </button>
        <button
          type="button"
          onClick={saveSnapshot}
          disabled={isSaving || !report?.shipment_analysis.shipment_count}
          className={`${buttonSecondary} border-tertiary text-tertiary`}
        >
          {isSaving ? <Spinner /> : null}
          Save report snapshot
        </button>
        {report?.shipment_analysis.shipment_count ? (
          <button
            type="button"
            onClick={exportReport}
            disabled={isExporting}
            className={`${buttonSecondary} border-tertiary text-tertiary`}
          >
            {isExporting ? <Spinner /> : null}
            Export CSV report
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonSecondary}
        >
          Print report
        </button>
      </div>

      {statusMessage ? (
        <p className="mt-3 rounded-md border border-accent/35 bg-accent/10 px-3 py-2 text-sm text-primary">
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <p>{error}</p>
          {canLoadDemoData ? (
            <button
              type="button"
              onClick={() => void loadDemoData()}
              disabled={isLoadingDemoData}
              className={buttonPrimary}
            >
              {isLoadingDemoData ? (
                <Spinner />
              ) : (
                <Database aria-hidden="true" className="h-4 w-4" />
              )}
              Load demo data
            </button>
          ) : null}
        </div>
      ) : null}

      {report ? (
        <div className="mt-4 space-y-3">
          <MetricStrip
            items={[
              {
                label: "Shipments",
                value: report.shipment_analysis.shipment_count,
              },
              {
                label: "Total emissions",
                value: `${report.shipment_analysis.total_emissions_kg.toFixed(2)} kg CO2e`,
              },
              { label: "Suppliers", value: report.suppliers.length },
            ]}
          />

          {report.scenario ? (
            <Card as="article">
              <h2 className="text-base font-semibold text-primary">
                Scenario comparison
              </h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Current baseline
                  </dt>
                  <dd className="mt-0.5 font-mono text-lg font-medium tabular-nums text-primary">
                    {report.scenario.baseline_total_kg.toFixed(2)} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-xs capitalize text-muted-foreground">
                    {report.scenario.alternative_mode}
                  </dt>
                  <dd className="mt-0.5 font-mono text-lg font-medium tabular-nums text-primary">
                    {report.scenario.alternative_total_kg.toFixed(2)} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Change</dt>
                  <dd className="mt-0.5 font-mono text-lg font-medium tabular-nums text-primary">
                    {report.scenario.delta_kg > 0 ? "+" : ""}
                    {report.scenario.delta_kg.toFixed(2)} kg
                  </dd>
                </div>
              </dl>
            </Card>
          ) : null}

          <Card as="article" className="overflow-x-auto">
            <h2 className="text-base font-semibold text-primary">
              Emissions by mode
            </h2>
            {modes.length ? (
              <table className="mt-2 min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Mode</th>
                    <th className="px-3 py-1.5 text-right font-medium">
                      Shipments
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium">
                      Weight kg
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium">
                      Emissions kg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map(([mode, values]) => (
                    <tr
                      key={mode}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-1.5 font-medium capitalize">
                        {mode}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {values.shipment_count}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {values.weight_kg.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {values.emissions_kg.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Upload shipment data to populate the report.
              </p>
            )}
          </Card>

          <Card as="article">
            <h2 className="text-base font-semibold text-primary">
              Methodology
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {report.methodology.factor_source} · version{" "}
              {report.methodology.factor_version}.{" "}
              {report.methodology.factor_applicability}
            </p>
          </Card>
        </div>
      ) : isLoading ? (
        <LoadingState label="Loading report" />
      ) : null}
    </WorkspacePage>
  );
}
