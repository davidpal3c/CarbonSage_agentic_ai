"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { getBackendUrl } from "@/app/api/urls";

type Quota = { used: number; limit: number };

type WorkspaceSession = {
  workspace_id: string;
  expires_at: number;
  quotas: Record<string, Quota>;
  retention: { expires_at: number; policy: string };
};

type ShipmentRow = {
  shipment_id: string;
  origin: string;
  destination: string;
  weight_kg: number;
  distance_km: number;
  transport_method: string;
  source_row: number;
};

type ShipmentAnalysis = {
  shipment_count: number;
  total_weight_kg: number;
  total_emissions_kg: number;
  total_emissions_tonnes: number;
  mode_breakdown: Record<
    string,
    { shipment_count: number; weight_kg: number; emissions_kg: number }
  >;
  hotspots: Array<{
    shipment_id: string;
    origin: string;
    destination: string;
    transport_method: string;
    emissions_kg: number;
  }>;
  warnings: string[];
  factor_source: string;
  factor_version: string;
  factor_applicability: string;
  assumptions: string[];
};

type ShipmentData = {
  accepted_rows: number;
  errors: Array<{
    row_number: number | null;
    field: string | null;
    message: string;
  }>;
  warnings: string[];
  rows: ShipmentRow[];
  analysis: ShipmentAnalysis;
};

type SupplierCard = {
  supplier_id: string;
  name: string;
  region: string | null;
  certifications: string[];
  transport_modes: string[];
  document_count: number;
  missing_fields: string[];
};

type RetrievalMode = "lexical" | "semantic" | "hybrid";

type EvidenceMatch = {
  supplier_name: string;
  filename: string;
  excerpt: string;
  citation: {
    page_number: number | null;
    chunk_index: number;
    document_sha256: string;
    filename: string;
  };
  retrieval: {
    mode: RetrievalMode;
    score: number | null;
    lexical_rank: number | null;
    semantic_rank: number | null;
  };
};

type EvidenceSearchData = {
  query: string;
  requested_mode: RetrievalMode;
  mode: RetrievalMode;
  semantic_available: boolean;
  warning: string | null;
  matches: EvidenceMatch[];
};

type ScenarioData = {
  baseline_mode: string;
  alternative_mode: string;
  shipment_count: number;
  baseline_total_kg: number;
  alternative_total_kg: number;
  baseline_total_tonnes: number;
  alternative_total_tonnes: number;
  delta_kg: number;
  delta_percent: number | null;
  shipment_results: Array<{
    shipment_id: string;
    origin: string;
    destination: string;
    baseline_mode: string;
    alternative_mode: string;
    baseline_emissions_kg: number;
    alternative_emissions_kg: number;
    delta_kg: number;
  }>;
  factor_source: string;
  factor_version: string;
  assumptions: string[];
};

const navigation = [
  { label: "Overview", status: "Ready", href: "#overview" },
  { label: "Shipments", status: "Ready", href: "#shipments" },
  { label: "Suppliers / Evidence", status: "Ready", href: "#evidence" },
  { label: "Scenarios", status: "Ready", href: "#scenarios" },
  { label: "Report", status: "Ready", href: "#report" },
];

function formatExpiry(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

export default function UserPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null);
  const [shipmentError, setShipmentError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierCard[]>([]);
  const [evidenceMatches, setEvidenceMatches] = useState<EvidenceMatch[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierRegion, setSupplierRegion] = useState("");
  const [certifications, setCertifications] = useState("");
  const [transportModes, setTransportModes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceMode, setEvidenceMode] = useState<RetrievalMode>("lexical");
  const [evidenceSearchData, setEvidenceSearchData] =
    useState<EvidenceSearchData | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isEvidenceUploading, setIsEvidenceUploading] = useState(false);
  const [isSearchingEvidence, setIsSearchingEvidence] = useState(false);
  const [scenarioMode, setScenarioMode] = useState("train");
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [isRunningScenario, setIsRunningScenario] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    fetch(`${getBackendUrl()}/demo/session`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) {
          throw new Error("The workspace could not be loaded.");
        }
        return (await response.json()) as WorkspaceSession;
      })
      .then((workspace) => {
        if (workspace && isCurrent) {
          setSession(workspace);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setError(
            "The API is unavailable. Start the backend and reload this page.",
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [router]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let isCurrent = true;

    fetch(`${getBackendUrl()}/shipments`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Shipment data could not be loaded.");
        }
        return (await response.json()) as ShipmentData;
      })
      .then((shipments) => {
        if (isCurrent) {
          setShipmentData(shipments);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setShipmentError("Shipment data could not be loaded from the API.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    fetch(`${getBackendUrl()}/suppliers`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Supplier evidence could not be loaded.");
        }
        return (await response.json()) as { suppliers: SupplierCard[] };
      })
      .then((payload) => setSuppliers(payload.suppliers))
      .catch(() =>
        setEvidenceError("Supplier evidence could not be loaded from the API."),
      );
  }, [session]);

  function selectShipmentFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setShipmentError(null);
  }

  async function uploadShipments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setShipmentError("Choose a CSV file before uploading.");
      return;
    }

    setIsUploading(true);
    setShipmentError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch(`${getBackendUrl()}/shipments/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(
          detail?.detail ?? "Shipment CSV could not be uploaded.",
        );
      }
      setShipmentData((await response.json()) as ShipmentData);
      setSelectedFile(null);
      const workspaceResponse = await fetch(`${getBackendUrl()}/demo/session`, {
        credentials: "include",
      });
      if (workspaceResponse.ok) {
        setSession((await workspaceResponse.json()) as WorkspaceSession);
      }
    } catch (requestError) {
      setShipmentError(
        requestError instanceof Error
          ? requestError.message
          : "Shipment CSV could not be uploaded.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function selectEvidenceFile(event: ChangeEvent<HTMLInputElement>) {
    setEvidenceFile(event.target.files?.[0] ?? null);
    setEvidenceError(null);
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evidenceFile || !supplierName.trim()) {
      setEvidenceError("Choose a TXT/PDF file and provide the supplier name.");
      return;
    }
    setIsEvidenceUploading(true);
    setEvidenceError(null);
    try {
      const formData = new FormData();
      formData.append("file", evidenceFile);
      formData.append("supplier_name", supplierName);
      formData.append("supplier_region", supplierRegion);
      formData.append("certifications", certifications);
      formData.append("transport_modes", transportModes);
      const response = await fetch(`${getBackendUrl()}/evidence/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(detail?.detail ?? "Evidence could not be uploaded.");
      }
      const suppliersResponse = await fetch(`${getBackendUrl()}/suppliers`, {
        credentials: "include",
      });
      if (suppliersResponse.ok) {
        const payload = (await suppliersResponse.json()) as {
          suppliers: SupplierCard[];
        };
        setSuppliers(payload.suppliers);
      }
      setEvidenceFile(null);
      setSupplierName("");
      setEvidenceError(null);
      const workspaceResponse = await fetch(`${getBackendUrl()}/demo/session`, {
        credentials: "include",
      });
      if (workspaceResponse.ok) {
        setSession((await workspaceResponse.json()) as WorkspaceSession);
      }
    } catch (requestError) {
      setEvidenceError(
        requestError instanceof Error
          ? requestError.message
          : "Evidence could not be uploaded.",
      );
    } finally {
      setIsEvidenceUploading(false);
    }
  }

  async function searchEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (evidenceQuery.trim().length < 2) {
      setEvidenceError("Enter at least two characters to search evidence.");
      return;
    }
    setIsSearchingEvidence(true);
    setEvidenceError(null);
    setEvidenceMatches([]);
    setEvidenceSearchData(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/evidence/search?query=${encodeURIComponent(evidenceQuery.trim())}&mode=${evidenceMode}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(
          detail?.detail ?? "Evidence search could not be completed.",
        );
      }
      const payload = (await response.json()) as EvidenceSearchData;
      setEvidenceMatches(payload.matches);
      setEvidenceSearchData(payload);
    } catch (requestError) {
      setEvidenceError(
        requestError instanceof Error
          ? requestError.message
          : "Evidence search could not be completed.",
      );
    } finally {
      setIsSearchingEvidence(false);
    }
  }

  async function runScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunningScenario(true);
    setScenarioError(null);
    try {
      const response = await fetch(`${getBackendUrl()}/scenarios/compare`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alternative_transport_method: scenarioMode }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(
          detail?.detail ?? "Scenario comparison could not be completed.",
        );
      }
      setScenarioData((await response.json()) as ScenarioData);
      const workspaceResponse = await fetch(`${getBackendUrl()}/demo/session`, {
        credentials: "include",
      });
      if (workspaceResponse.ok) {
        setSession((await workspaceResponse.json()) as WorkspaceSession);
      }
    } catch (requestError) {
      setScenarioError(
        requestError instanceof Error
          ? requestError.message
          : "Scenario comparison could not be completed.",
      );
    } finally {
      setIsRunningScenario(false);
    }
  }

  async function exportReport() {
    setIsExportingReport(true);
    setScenarioError(null);
    try {
      const query = scenarioData
        ? `?alternative_mode=${encodeURIComponent(scenarioData.alternative_mode)}`
        : "";
      const response = await fetch(
        `${getBackendUrl()}/reports/export.csv${query}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Report export could not be completed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "carbonsage-report.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setScenarioError(
        requestError instanceof Error
          ? requestError.message
          : "Report export could not be completed.",
      );
    } finally {
      setIsExportingReport(false);
    }
  }

  async function leaveWorkspace() {
    try {
      await fetch(`${getBackendUrl()}/demo/session`, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  const modeBreakdown = shipmentData
    ? Object.entries(shipmentData.analysis.mode_breakdown)
    : [];
  const maxModeEmissions = Math.max(
    ...modeBreakdown.map(([, breakdown]) => breakdown.emissions_kg),
    0.000001,
  );
  const hotspotRows = shipmentData?.analysis.hotspots.slice(0, 5) ?? [];
  const maxHotspotEmissions = Math.max(
    ...hotspotRows.map((hotspot) => hotspot.emissions_kg),
    0.000001,
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-red-800">
          {error}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading private workspace…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col overflow-x-clip lg:flex-row">
      <aside className="border-b border-border px-6 py-6 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r lg:py-8">
        <div className="mb-10">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            🌱 CarbonSage
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            ESG agent control plane
          </p>
        </div>
        <nav aria-label="Workspace navigation" className="space-y-2">
          {navigation.map((item, index) => (
            <a
              href={item.href}
              key={item.label}
              className={`flex items-center justify-between rounded-lg px-3 py-3 text-sm ${
                index === 0 ? "bg-secondary text-white" : "text-primary"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={
                  index === 0 ? "text-white/70" : "text-muted-foreground"
                }
              >
                {item.status}
              </span>
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={leaveWorkspace}
          className="mt-10 text-sm font-semibold text-primary hover:text-accent"
        >
          Leave workspace
        </button>
      </aside>

      <section
        id="overview"
        className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
              Private workspace
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-primary">
              Overview
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Review traceable shipment calculations, supplier evidence, and
              decision-ready scenario reports in one isolated workspace.
            </p>
          </div>
          <code className="max-w-full break-all rounded-lg border border-border bg-muted px-3 py-2 text-xs text-primary">
            {session.workspace_id}
          </code>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-xl border border-border bg-muted p-5">
            <p className="text-sm text-muted-foreground">Workspace retention</p>
            <p className="mt-2 text-2xl font-bold text-primary">Active</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Expires {formatExpiry(session.retention.expires_at)}
            </p>
          </article>
          <article className="rounded-xl border border-border bg-muted p-5">
            <p className="text-sm text-muted-foreground">Evidence documents</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {session.quotas.evidence_documents.used} /{" "}
              {session.quotas.evidence_documents.limit}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Documents per workspace
            </p>
          </article>
          <article className="rounded-xl border border-border bg-muted p-5">
            <p className="text-sm text-muted-foreground">Analysis runs today</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {session.quotas.analysis_runs_per_day.used} /{" "}
              {session.quotas.analysis_runs_per_day.limit}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Deterministic calculations
            </p>
          </article>
        </div>

        <div className="mt-8 rounded-xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold text-primary">
            Phase 2 boundary verified
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            This page only loads after the API accepts the signed workspace
            cookie. Direct emissions calls without that cookie receive a safe
            401 response, and each new visitor receives a different workspace
            id.
          </p>
        </div>

        <section
          id="shipments"
          className="mt-8 rounded-xl border border-border bg-muted p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
                Phase 3
              </p>
              <h2 className="text-2xl font-semibold text-primary">
                Shipment baseline
              </h2>
              <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
                Upload the documented CSV schema. Invalid rows stay visible as
                quality warnings while accepted rows are normalized and counted.
              </p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-primary">
              Max 500 rows · 10 MB
            </span>
          </div>

          <form
            onSubmit={uploadShipments}
            className="mt-6 flex flex-wrap items-end gap-3"
          >
            <label className="flex w-full min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-primary sm:min-w-64">
              Shipment CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={selectShipmentFile}
                className="w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-primary file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={isUploading}
              className="rounded-full bg-secondary px-5 py-3 font-semibold text-white transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
            >
              {isUploading ? "Analyzing…" : "Upload and analyze"}
            </button>
          </form>

          {shipmentError ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {shipmentError}
            </p>
          ) : null}

          {shipmentData ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">
                    Accepted shipments
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {shipmentData.analysis.shipment_count}
                  </p>
                </article>
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">
                    Total emissions
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {shipmentData.analysis.total_emissions_kg.toFixed(2)} kg
                    CO₂e
                  </p>
                </article>
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">
                    Total freight weight
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {shipmentData.analysis.total_weight_kg.toFixed(2)} kg
                  </p>
                </article>
              </div>

              {shipmentData.errors.length > 0 ? (
                <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Data-quality issues</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {shipmentData.errors.slice(0, 8).map((issue, index) => (
                      <li key={`${issue.row_number}-${issue.field}-${index}`}>
                        {issue.row_number ? `Row ${issue.row_number}: ` : ""}
                        {issue.field ? `${issue.field} — ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-primary">
                    Emissions by mode
                  </h3>
                  <div
                    className="mt-3 space-y-3"
                    aria-label="Emissions by freight mode"
                  >
                    {modeBreakdown.map(([mode, breakdown]) => (
                      <div key={mode}>
                        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                          <span className="font-semibold capitalize text-primary">
                            {mode}
                          </span>
                          <span>
                            {breakdown.emissions_kg.toFixed(2)} kg ·{" "}
                            {breakdown.shipment_count} shipments
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-border">
                          <div
                            className="h-3 rounded-full bg-secondary"
                            style={{
                              width: `${Math.min(
                                100,
                                (breakdown.emissions_kg / maxModeEmissions) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <table className="sr-only">
                    <caption>Emissions by freight mode</caption>
                    <thead>
                      <tr>
                        <th>Mode</th>
                        <th>Emissions kg</th>
                        <th>Shipments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modeBreakdown.map(([mode, breakdown]) => (
                        <tr key={mode}>
                          <td>{mode}</td>
                          <td>{breakdown.emissions_kg}</td>
                          <td>{breakdown.shipment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="font-semibold text-primary">
                    Top shipment hotspots
                  </h3>
                  <div
                    className="mt-3 space-y-3"
                    aria-label="Top shipment emissions hotspots"
                  >
                    {hotspotRows.map((hotspot) => (
                      <div key={hotspot.shipment_id}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="text-primary">
                            <strong>{hotspot.shipment_id}</strong>
                            <span className="ml-2 text-muted-foreground">
                              {hotspot.origin} → {hotspot.destination}
                            </span>
                          </span>
                          <span className="font-semibold text-primary">
                            {hotspot.emissions_kg.toFixed(2)} kg
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-border">
                          <div
                            className="h-3 rounded-full bg-accent"
                            style={{
                              width: `${Math.min(
                                100,
                                (hotspot.emissions_kg / maxHotspotEmissions) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <table className="sr-only">
                    <caption>Top shipment emissions hotspots</caption>
                    <thead>
                      <tr>
                        <th>Shipment</th>
                        <th>Route</th>
                        <th>Emissions kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspotRows.map((hotspot) => (
                        <tr key={hotspot.shipment_id}>
                          <td>{hotspot.shipment_id}</td>
                          <td>
                            {hotspot.origin} → {hotspot.destination}
                          </td>
                          <td>{hotspot.emissions_kg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">
                    Normalized shipment rows
                  </caption>
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Shipment</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Distance</th>
                      <th className="px-4 py-3">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentData.rows.slice(0, 10).map((row) => (
                      <tr
                        key={`${row.shipment_id}-${row.source_row}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 font-semibold text-primary">
                          {row.shipment_id}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.origin} → {row.destination}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.weight_kg} kg
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.distance_km} km
                        </td>
                        <td className="px-4 py-3 capitalize text-primary">
                          {row.transport_method}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Factor source: {shipmentData.analysis.factor_source} · version{" "}
                {shipmentData.analysis.factor_version}.{" "}
                {shipmentData.analysis.factor_applicability}
              </p>
            </>
          ) : null}
        </section>

        <section
          id="evidence"
          className="mt-8 rounded-xl border border-border bg-muted p-6"
        >
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
              Phase 4
            </p>
            <h2 className="text-2xl font-semibold text-primary">
              Supplier evidence
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
              Upload a text-based supplier document, record the structured facts
              you know, and search the extracted text with recoverable
              citations.
            </p>
          </div>

          <form
            onSubmit={uploadEvidence}
            className="mt-6 grid gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-2"
          >
            <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
              Supplier name
              <input
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Supplier ABC"
                className="rounded-lg border border-border bg-muted px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
              Region (optional)
              <input
                value={supplierRegion}
                onChange={(event) => setSupplierRegion(event.target.value)}
                placeholder="Canada"
                className="rounded-lg border border-border bg-muted px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
              Certifications (comma separated)
              <input
                value={certifications}
                onChange={(event) => setCertifications(event.target.value)}
                placeholder="ISO 14001"
                className="rounded-lg border border-border bg-muted px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
              Transport modes (comma separated)
              <input
                value={transportModes}
                onChange={(event) => setTransportModes(event.target.value)}
                placeholder="rail, truck"
                className="rounded-lg border border-border bg-muted px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-primary md:col-span-2">
              Evidence document (TXT or text-based PDF)
              <input
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={selectEvidenceFile}
                className="w-full min-w-0 max-w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-normal text-primary file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-white"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isEvidenceUploading}
                className="rounded-full bg-secondary px-5 py-3 font-semibold text-white transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
              >
                {isEvidenceUploading ? "Extracting…" : "Upload evidence"}
              </button>
              <span className="ml-3 text-xs text-muted-foreground">
                Max 3 documents per workspace · 10 MB each
              </span>
            </div>
          </form>

          {evidenceError ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {evidenceError}
            </p>
          ) : null}

          <div className="mt-6">
            <h3 className="font-semibold text-primary">Supplier cards</h3>
            {suppliers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No supplier evidence has been uploaded in this workspace.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {suppliers.map((supplier) => (
                  <article
                    key={supplier.supplier_id}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-primary">
                          {supplier.name}
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {supplier.region ?? "Region not provided"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {supplier.document_count} document
                        {supplier.document_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {supplier.certifications.map((certification) => (
                        <span
                          key={certification}
                          className="rounded-full bg-secondary/10 px-2 py-1 text-primary"
                        >
                          {certification}
                        </span>
                      ))}
                      {supplier.transport_modes.map((mode) => (
                        <span
                          key={mode}
                          className="rounded-full bg-accent/10 px-2 py-1 capitalize text-primary"
                        >
                          {mode}
                        </span>
                      ))}
                    </div>
                    {supplier.missing_fields.length > 0 ? (
                      <p className="mt-4 text-xs text-amber-800">
                        Missing metadata: {supplier.missing_fields.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-4 text-xs text-emerald-800">
                        Structured metadata is complete.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={searchEvidence} className="mt-8">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex w-full min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-primary sm:min-w-64">
                Search document evidence
                <input
                  value={evidenceQuery}
                  onChange={(event) => setEvidenceQuery(event.target.value)}
                  placeholder="ISO 14001"
                  className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-primary">
                Retrieval mode
                <select
                  value={evidenceMode}
                  onChange={(event) =>
                    setEvidenceMode(event.target.value as RetrievalMode)
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 font-normal capitalize"
                >
                  <option value="lexical">Lexical</option>
                  <option value="semantic">Semantic</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={isSearchingEvidence}
                className="rounded-full border border-secondary px-5 py-2 font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isSearchingEvidence ? "Searching…" : "Search citations"}
              </button>
            </div>
          </form>

          {evidenceSearchData ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Used {evidenceSearchData.mode} retrieval · semantic provider{" "}
              {evidenceSearchData.semantic_available
                ? "available"
                : "unavailable"}
              {evidenceSearchData.warning
                ? ` · ${evidenceSearchData.warning}`
                : ""}
            </p>
          ) : null}

          {evidenceMatches.length > 0 ? (
            <div className="mt-5 space-y-3">
              {evidenceMatches.map((match) => (
                <article
                  key={`${match.citation.document_sha256}-${match.citation.chunk_index}`}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <p className="text-sm font-semibold text-primary">
                    {match.supplier_name} · {match.filename}
                  </p>
                  <blockquote className="mt-2 border-l-2 border-accent pl-3 text-sm leading-6 text-muted-foreground">
                    {match.excerpt}
                  </blockquote>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Citation: {match.citation.filename}, chunk{" "}
                    {match.citation.chunk_index}
                    {match.citation.page_number
                      ? `, page ${match.citation.page_number}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Retrieval: {match.retrieval.mode}
                    {match.retrieval.lexical_rank
                      ? ` · lexical rank ${match.retrieval.lexical_rank}`
                      : ""}
                    {match.retrieval.semantic_rank
                      ? ` · semantic rank ${match.retrieval.semantic_rank}`
                      : ""}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section
          id="scenarios"
          className="mt-8 rounded-xl border border-border bg-muted p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
                Phase 5
              </p>
              <h2 className="text-2xl font-semibold text-primary">
                Scenario comparison
              </h2>
              <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
                Compare the current shipment modes with one consistent
                alternative while keeping the factor source and assumptions
                visible.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full border border-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white"
            >
              Print report
            </button>
          </div>

          <form
            onSubmit={runScenario}
            className="mt-6 flex flex-wrap items-end gap-3"
          >
            <label className="flex w-full min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-primary sm:min-w-56">
              Alternative freight mode
              <select
                value={scenarioMode}
                onChange={(event) => setScenarioMode(event.target.value)}
                className="w-full min-w-0 max-w-full rounded-lg border border-border bg-background px-3 py-2 font-normal capitalize"
              >
                <option value="plane">Plane</option>
                <option value="truck">Truck</option>
                <option value="train">Train</option>
                <option value="ship">Ship</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={
                isRunningScenario || !shipmentData?.analysis.shipment_count
              }
              className="rounded-full bg-secondary px-5 py-3 font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningScenario ? "Comparing…" : "Run scenario"}
            </button>
            <button
              type="button"
              onClick={exportReport}
              disabled={isExportingReport}
              className="rounded-full border border-secondary px-5 py-3 font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isExportingReport ? "Exporting…" : "Export CSV report"}
            </button>
          </form>

          {scenarioError ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {scenarioError}
            </p>
          ) : null}

          {scenarioData ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">
                    Current baseline
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {scenarioData.baseline_total_kg.toFixed(2)} kg
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {scenarioData.baseline_mode} / {scenarioData.shipment_count}{" "}
                    shipments
                  </p>
                </article>
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Alternative</p>
                  <p className="mt-1 text-2xl font-bold text-primary">
                    {scenarioData.alternative_total_kg.toFixed(2)} kg
                  </p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {scenarioData.alternative_mode} / same shipment inputs
                  </p>
                </article>
                <article className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      scenarioData.delta_kg <= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {scenarioData.delta_kg > 0 ? "+" : ""}
                    {scenarioData.delta_kg.toFixed(2)} kg
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scenarioData.delta_percent === null
                      ? "No baseline percentage"
                      : `${scenarioData.delta_percent.toFixed(2)}% vs baseline`}
                  </p>
                </article>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-primary">
                    Totals at a glance
                  </h3>
                  <div
                    className="mt-3 space-y-3"
                    aria-label="Scenario emissions bars"
                  >
                    <div>
                      <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                        <span>Baseline</span>
                        <span>
                          {scenarioData.baseline_total_kg.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-border">
                        <div
                          className="h-3 rounded-full bg-primary"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                        <span className="capitalize">
                          {scenarioData.alternative_mode}
                        </span>
                        <span>
                          {scenarioData.alternative_total_kg.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-border">
                        <div
                          className="h-3 rounded-full bg-accent"
                          style={{
                            width: `${Math.min(
                              100,
                              (scenarioData.alternative_total_kg /
                                Math.max(
                                  scenarioData.baseline_total_kg,
                                  0.000001,
                                )) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div id="report">
                  <h3 className="font-semibold text-primary">
                    Report preview · methodology
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {scenarioData.factor_source} · version{" "}
                    {scenarioData.factor_version}. {scenarioData.assumptions[0]}
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">
                    Scenario result by shipment
                  </caption>
                  <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Shipment</th>
                      <th className="px-4 py-3">Baseline kg</th>
                      <th className="px-4 py-3">Alternative kg</th>
                      <th className="px-4 py-3">Delta kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioData.shipment_results.map((result) => (
                      <tr
                        key={result.shipment_id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 font-semibold text-primary">
                          {result.shipment_id}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {result.baseline_emissions_kg.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {result.alternative_emissions_kg.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 font-semibold ${
                            result.delta_kg <= 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {result.delta_kg > 0 ? "+" : ""}
                          {result.delta_kg.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Upload shipments to compare an alternative freight mode.
            </p>
          )}
        </section>
      </section>
    </div>
  );
}
