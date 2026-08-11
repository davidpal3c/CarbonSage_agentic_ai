"use client";

import { useEffect, useState } from "react";

import { getBackendUrl } from "@/app/api/urls";

type ModeBreakdown = {
  shipment_count: number;
  weight_kg: number;
  emissions_kg: number;
};

type ReportData = {
  generated_at: number;
  shipment_analysis: {
    shipment_count: number;
    total_weight_kg: number;
    total_emissions_kg: number;
    total_emissions_tonnes: number;
    mode_breakdown: Record<string, ModeBreakdown>;
  };
  scenario: {
    baseline_mode: string;
    alternative_mode: string;
    shipment_count: number;
    baseline_total_kg: number;
    alternative_total_kg: number;
    delta_kg: number;
    delta_percent: number | null;
  } | null;
  suppliers: Array<{
    supplier_id: string;
    name: string;
    region: string | null;
    document_count: number;
  }>;
  methodology: {
    factor_source: string;
    factor_version: string;
    factor_applicability: string;
    assumptions: string[];
    warnings: string[];
  };
};

const alternatives = ["plane", "truck", "train", "ship"] as const;

export default function ReportPage() {
  const [alternativeMode, setAlternativeMode] = useState("train");
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function requestReport(mode: string) {
    const query = mode ? `?alternative_mode=${encodeURIComponent(mode)}` : "";
    const response = await fetch(`${getBackendUrl()}/reports/preview${query}`, {
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(
        payload?.detail ?? "The report preview could not be loaded.",
      );
    }
    return (await response.json()) as ReportData;
  }

  useEffect(() => {
    let isCurrent = true;
    requestReport("train")
      .then((payload) => {
        if (isCurrent) setReport(payload);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The report preview could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function refreshReport() {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      setReport(await requestReport(alternativeMode));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The report preview could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function exportReport() {
    setIsExporting(true);
    setError(null);
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
      setError(
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
    setError(null);
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
      setStatusMessage(`Saved ${payload.artifact.title}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Report snapshot could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const modes = report
    ? Object.entries(report.shipment_analysis.mode_breakdown)
    : [];

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
          Decision output
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-primary">
          Report
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          Review a current workspace report, compare one freight alternative,
          save a traceable snapshot, or export the normalized result.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted p-5">
        <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm font-semibold text-primary">
          Report alternative
          <select
            value={alternativeMode}
            onChange={(event) => setAlternativeMode(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 font-normal capitalize"
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
          className="rounded-full bg-secondary px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? "Refreshing…" : "Refresh report"}
        </button>
        <button
          type="button"
          onClick={saveSnapshot}
          disabled={isSaving || !report?.shipment_analysis.shipment_count}
          className="rounded-full border border-secondary px-5 py-2.5 font-semibold text-secondary disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save report snapshot"}
        </button>
        <button
          type="button"
          onClick={exportReport}
          disabled={isExporting}
          className="rounded-full border border-secondary px-5 py-2.5 font-semibold text-secondary disabled:opacity-60"
        >
          {isExporting ? "Exporting…" : "Export CSV report"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-border px-5 py-2.5 font-semibold text-primary"
        >
          Print report
        </button>
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {report ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-muted p-5">
              <p className="text-sm text-muted-foreground">Shipments</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {report.shipment_analysis.shipment_count}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted p-5">
              <p className="text-sm text-muted-foreground">Total emissions</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {report.shipment_analysis.total_emissions_kg.toFixed(2)} kg CO2e
              </p>
            </article>
            <article className="rounded-xl border border-border bg-muted p-5">
              <p className="text-sm text-muted-foreground">Suppliers</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {report.suppliers.length}
              </p>
            </article>
          </div>

          {report.scenario ? (
            <article className="rounded-xl border border-border bg-muted p-5">
              <h2 className="text-xl font-semibold text-primary">
                Scenario comparison
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Current baseline
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-primary">
                    {report.scenario.baseline_total_kg.toFixed(2)} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-sm capitalize text-muted-foreground">
                    {report.scenario.alternative_mode}
                  </dt>
                  <dd className="mt-1 text-xl font-bold text-primary">
                    {report.scenario.alternative_total_kg.toFixed(2)} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Change</dt>
                  <dd className="mt-1 text-xl font-bold text-primary">
                    {report.scenario.delta_kg > 0 ? "+" : ""}
                    {report.scenario.delta_kg.toFixed(2)} kg
                  </dd>
                </div>
              </dl>
            </article>
          ) : null}

          <article className="overflow-x-auto rounded-xl border border-border bg-muted p-5">
            <h2 className="text-xl font-semibold text-primary">
              Emissions by mode
            </h2>
            {modes.length ? (
              <table className="mt-4 min-w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Shipments</th>
                    <th className="px-3 py-2">Weight kg</th>
                    <th className="px-3 py-2">Emissions kg</th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map(([mode, values]) => (
                    <tr
                      key={mode}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-3 font-semibold capitalize">
                        {mode}
                      </td>
                      <td className="px-3 py-3">{values.shipment_count}</td>
                      <td className="px-3 py-3">
                        {values.weight_kg.toFixed(2)}
                      </td>
                      <td className="px-3 py-3">
                        {values.emissions_kg.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Upload shipment data to populate the report.
              </p>
            )}
          </article>

          <article className="rounded-xl border border-border bg-muted p-5">
            <h2 className="text-xl font-semibold text-primary">Methodology</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {report.methodology.factor_source} · version{" "}
              {report.methodology.factor_version}.{" "}
              {report.methodology.factor_applicability}
            </p>
          </article>
        </div>
      ) : isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading report…</p>
      ) : null}
    </section>
  );
}
