"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import ArtifactCatalog, {
  type ArtifactKind,
} from "@/app/dashboard/ArtifactCatalog";
import { useWorkspace } from "@/app/dashboard/WorkspaceShell";

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
    artifact_id: string;
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

export type WorkspaceSection =
  | "overview"
  | "artifacts"
  | "shipments"
  | "evidence"
  | "scenarios";

const sectionDetails: Record<
  WorkspaceSection,
  { title: string; description: string }
> = {
  overview: {
    title: "Overview",
    description:
      "A quick view of your workspace activity and the next useful actions.",
  },
  artifacts: {
    title: "Artifacts",
    description:
      "Manage uploaded datasets, evidence documents, and saved reports.",
  },
  shipments: {
    title: "Shipments",
    description:
      "Upload freight data and review emissions, routes, and data quality.",
  },
  evidence: {
    title: "Suppliers",
    description:
      "Review supplier profiles and search the documents behind them.",
  },
  scenarios: {
    title: "Scenarios",
    description: "Compare freight alternatives using the same shipment inputs.",
  },
};

function formatExpiry(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

export function WorkspaceSectionPage({
  section,
  focusedArtifactId,
}: {
  section: WorkspaceSection;
  focusedArtifactId?: string;
}) {
  const { session, refreshSession } = useWorkspace();
  const details = sectionDetails[section];
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
  const [artifactRefreshToken, setArtifactRefreshToken] = useState(0);
  const [artifactStatus, setArtifactStatus] = useState<string | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  useEffect(() => {
    if (section !== "shipments" && section !== "scenarios") return;
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
  }, [section, session.workspace_id]);

  useEffect(() => {
    if (section !== "evidence") return;
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
  }, [section, session.workspace_id]);

  function selectShipmentFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setShipmentError(null);
  }

  async function uploadShipments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setShipmentError("Choose a CSV or XLSX file before uploading.");
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
          detail?.detail ?? "Shipment data could not be uploaded.",
        );
      }
      setShipmentData((await response.json()) as ShipmentData);
      setArtifactRefreshToken((current) => current + 1);
      setSelectedFile(null);
      await refreshSession();
    } catch (requestError) {
      setShipmentError(
        requestError instanceof Error
          ? requestError.message
          : "Shipment data could not be uploaded.",
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
    if (!supplierName.trim()) {
      setEvidenceError("Provide the supplier name.");
      return;
    }
    setIsEvidenceUploading(true);
    setEvidenceError(null);
    try {
      let response: Response;
      if (evidenceFile) {
        const formData = new FormData();
        formData.append("file", evidenceFile);
        formData.append("supplier_name", supplierName);
        formData.append("supplier_region", supplierRegion);
        formData.append("certifications", certifications);
        formData.append("transport_modes", transportModes);
        response = await fetch(`${getBackendUrl()}/evidence/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      } else {
        response = await fetch(`${getBackendUrl()}/suppliers`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: supplierName,
            region: supplierRegion || null,
            certifications: certifications
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            transport_modes: transportModes
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        });
      }
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
      setArtifactRefreshToken((current) => current + 1);
      setEvidenceFile(null);
      setSupplierName("");
      setSupplierRegion("");
      setCertifications("");
      setTransportModes("");
      setIsSupplierModalOpen(false);
      setEvidenceError(null);
      await refreshSession();
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
      await refreshSession();
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

  async function handleArtifactDeleted(kind: ArtifactKind) {
    setArtifactRefreshToken((current) => current + 1);
    if (kind === "shipment_dataset") {
      setShipmentData(null);
      setScenarioData(null);
      setArtifactStatus(
        "The shipment dataset and its active analysis were removed.",
      );
      return;
    }
    if (kind === "evidence_document") {
      setEvidenceMatches([]);
      setEvidenceSearchData(null);
      const response = await fetch(`${getBackendUrl()}/suppliers`, {
        credentials: "include",
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          suppliers: SupplierCard[];
        };
        setSuppliers(payload.suppliers);
      }
      setArtifactStatus(
        "The evidence artifact was removed from active retrieval.",
      );
      return;
    }
    setArtifactStatus("The saved report snapshot was removed.");
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

  return (
    <section className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            {details.title}
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
            {details.description}
          </p>
        </div>
        {section === "evidence" ? (
          <button
            type="button"
            onClick={() => {
              setEvidenceError(null);
              setIsSupplierModalOpen(true);
            }}
            className="rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent"
          >
            Add supplier
          </button>
        ) : null}
        {section === "shipments" ? (
          <Link
            href="/dashboard/agent"
            className="rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent"
          >
            Calculate freight
          </Link>
        ) : null}
      </header>

      {section === "overview" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Workspace</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-primary">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                Active
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Expires {formatExpiry(session.retention.expires_at)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Evidence files</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {session.quotas.evidence_documents.used} /{" "}
                {session.quotas.evidence_documents.limit}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Uploaded</p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Analysis runs</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {session.quotas.analysis_runs_per_day.used} /{" "}
                {session.quotas.analysis_runs_per_day.limit}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Today</p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Agent requests</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {session.quotas.assistant_requests_per_day.used} /{" "}
                {session.quotas.assistant_requests_per_day.limit}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Today</p>
            </article>
          </div>

          <section className="mt-8" aria-labelledby="workspace-actions-title">
            <h2
              id="workspace-actions-title"
              className="text-lg font-semibold text-primary"
            >
              Continue your work
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                {
                  href: "/dashboard/shipments",
                  title: "Add shipment data",
                  description: "Upload a CSV and review freight emissions.",
                },
                {
                  href: "/dashboard/evidence",
                  title: "Add supplier evidence",
                  description: "Upload documents and search their contents.",
                },
                {
                  href: "/dashboard/agent",
                  title: "Ask CarbonSage",
                  description: "Explore the workspace in a conversation.",
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-sm"
                >
                  <span className="font-semibold text-primary">
                    {action.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {action.description}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {section === "artifacts" ? (
        <ArtifactCatalog
          refreshToken={artifactRefreshToken}
          onDeleted={handleArtifactDeleted}
          focusedArtifactId={focusedArtifactId}
        />
      ) : null}

      {section === "artifacts" ? (
        <p className="sr-only" role="status" aria-live="polite">
          {artifactStatus}
        </p>
      ) : null}

      {section === "shipments" ? (
        <section id="shipments" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Shipments</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {shipmentData?.analysis.shipment_count ?? 0}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total emissions</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {(shipmentData?.analysis.total_emissions_kg ?? 0).toFixed(2)} kg
                CO₂e
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Freight weight</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {(shipmentData?.analysis.total_weight_kg ?? 0).toFixed(2)} kg
              </p>
            </article>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-primary">
                  Import shipments
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Add a CSV or XLSX workbook. Common column names are matched
                  automatically, and rows needing attention remain visible.
                </p>
              </div>
              <a
                href={`${getBackendUrl()}/shipments/template`}
                className="text-sm font-semibold text-secondary hover:text-accent"
              >
                Download XLSX template
              </a>
            </div>
            <form
              onSubmit={uploadShipments}
              className="mt-5 flex flex-wrap items-end gap-3"
            >
              <label className="flex w-full min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-primary sm:min-w-64">
                Shipment file
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            <p className="mt-3 text-xs text-muted-foreground">
              Max 500 rows · 10 MB
            </p>
          </div>

          {shipmentError ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {shipmentError}
            </p>
          ) : null}

          {shipmentData ? (
            <>
              {shipmentData.errors.length > 0 ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
      ) : null}

      {section === "evidence" ? (
        <section
          id="evidence"
          className="flex flex-col rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          {isSupplierModalOpen ? (
            <>
              <button
                type="button"
                aria-label="Close add supplier dialog"
                onClick={() => setIsSupplierModalOpen(false)}
                className="fixed inset-0 z-[60] cursor-default bg-black/35 backdrop-blur-[1px]"
              />
              <form
                onSubmit={uploadEvidence}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-supplier-title"
                className="fixed left-1/2 top-1/2 z-[70] grid max-h-[calc(100vh-2rem)] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl md:grid-cols-2 md:p-6"
              >
                <div className="flex items-start justify-between gap-4 md:col-span-2">
                  <div>
                    <h2
                      id="add-supplier-title"
                      className="text-xl font-semibold text-primary"
                    >
                      Add supplier
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add the profile now and attach a PDF or TXT source when
                      available.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    aria-label="Close dialog"
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
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
                  Evidence document (optional PDF or TXT)
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
                    {isEvidenceUploading ? "Saving…" : "Add supplier"}
                  </button>
                  <span className="ml-3 text-xs text-muted-foreground">
                    Attached documents: max 10 MB
                  </span>
                </div>
              </form>
            </>
          ) : null}

          {evidenceError ? (
            <p className="order-1 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {evidenceError}
            </p>
          ) : null}

          <div className="order-4 mt-7">
            <h3 className="font-semibold text-primary">Supplier cards</h3>
            {suppliers.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No suppliers have been added to this workspace.
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
                      <p className="mt-4 text-xs text-muted-foreground">
                        Supplier details complete.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={searchEvidence} className="order-1">
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
                  <option value="lexical">Keyword</option>
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
            <p className="order-2 mt-3 text-xs text-muted-foreground">
              {evidenceSearchData.mode === "lexical"
                ? "Keyword search"
                : `${evidenceSearchData.mode[0].toUpperCase()}${evidenceSearchData.mode.slice(1)} search`}
              {evidenceSearchData.warning
                ? ` · ${evidenceSearchData.warning}`
                : ""}
            </p>
          ) : null}

          {evidenceMatches.length > 0 ? (
            <div className="order-3 mt-5 space-y-3">
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
      ) : null}

      {section === "scenarios" ? (
        <section
          id="scenarios"
          className="rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-primary">
                Compare an alternative
              </h2>
              <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
                Apply one freight mode to the current shipment inputs and see
                the difference from the baseline.
              </p>
            </div>
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
                        ? "text-accent"
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
                <div>
                  <h3 className="font-semibold text-primary">Methodology</h3>
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
                              ? "text-accent"
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
      ) : null}
    </section>
  );
}
