"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Database,
  Files,
  PackageCheck,
  Truck,
  UploadCloud,
  Weight,
  X,
} from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { LoadingState, Spinner } from "@/app/components/Spinner";
import { AnimatedNumber } from "@/app/components/AnimatedNumber";
import {
  ShipmentHotspotChart,
  ShipmentModeDonutChart,
  ShipmentTrendChart,
} from "@/app/components/charts/CarbonCharts";
import ArtifactCatalog from "@/app/dashboard/ArtifactCatalog";
import { useWorkspace } from "@/app/dashboard/WorkspaceShell";
import {
  type ShipmentData,
  shipmentAnalyticsKey,
  useWorkspaceDataStore,
} from "@/app/dashboard/workspace-data-store";

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
      "Monitor freight emissions, operational hotspots, and workspace activity.",
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

const artifactKindLabels = {
  shipment_dataset: "Shipments",
  evidence_document: "Evidence",
  report_snapshot: "Report",
} as const;

function modeColor(mode: string) {
  return ["plane", "truck", "train", "ship"].includes(mode)
    ? `var(--chart-${mode})`
    : "var(--chart-highlight)";
}

const dashboardModes = ["plane", "ship", "train", "truck"] as const;

export function WorkspaceSectionPage({
  section,
  focusedArtifactId,
}: {
  section: WorkspaceSection;
  focusedArtifactId?: string;
}) {
  const router = useRouter();
  const { session, refreshSession } = useWorkspace();
  const details = sectionDetails[section];
  const shipmentData = useWorkspaceDataStore((state) => state.shipments);
  const shipmentsStatus = useWorkspaceDataStore(
    (state) => state.shipmentsStatus,
  );
  const cachedShipmentError = useWorkspaceDataStore(
    (state) => state.shipmentsError,
  );
  const ensureShipments = useWorkspaceDataStore(
    (state) => state.ensureShipments,
  );
  const uploadWorkspaceShipments = useWorkspaceDataStore(
    (state) => state.uploadShipments,
  );
  const ensureShipmentAnalytics = useWorkspaceDataStore(
    (state) => state.ensureShipmentAnalytics,
  );
  const artifacts = useWorkspaceDataStore((state) => state.artifacts);
  const artifactsStatus = useWorkspaceDataStore(
    (state) => state.artifactsStatus,
  );
  const ensureArtifacts = useWorkspaceDataStore(
    (state) => state.ensureArtifacts,
  );
  const loadWorkspaceDemoData = useWorkspaceDataStore(
    (state) => state.loadDemoData,
  );
  const suppliers = useWorkspaceDataStore((state) => state.suppliers);
  const suppliersStatus = useWorkspaceDataStore(
    (state) => state.suppliersStatus,
  );
  const cachedSuppliersError = useWorkspaceDataStore(
    (state) => state.suppliersError,
  );
  const ensureSuppliers = useWorkspaceDataStore(
    (state) => state.ensureSuppliers,
  );
  const refreshAfterEvidenceMutation = useWorkspaceDataStore(
    (state) => state.refreshAfterEvidenceMutation,
  );
  const [localShipmentError, setShipmentError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [isDraggingShipmentFile, setIsDraggingShipmentFile] = useState(false);
  const [shipmentImportIssues, setShipmentImportIssues] = useState<
    ShipmentData["errors"]
  >([]);
  const shipmentInputRef = useRef<HTMLInputElement>(null);
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
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isLoadingDemoData, setIsLoadingDemoData] = useState(false);
  const [demoLoadError, setDemoLoadError] = useState<string | null>(null);
  const [analyticsGranularity, setAnalyticsGranularity] = useState<
    "month" | "year"
  >("month");
  const [analyticsStartDate, setAnalyticsStartDate] = useState("");
  const [analyticsEndDate, setAnalyticsEndDate] = useState("");
  const [analyticsModes, setAnalyticsModes] = useState<string[]>([]);
  const analyticsQuery = useMemo(
    () => ({
      granularity: analyticsGranularity,
      startDate: analyticsStartDate || undefined,
      endDate: analyticsEndDate || undefined,
      modes: analyticsModes,
    }),
    [
      analyticsEndDate,
      analyticsGranularity,
      analyticsModes,
      analyticsStartDate,
    ],
  );
  const analyticsKey = shipmentAnalyticsKey(analyticsQuery);
  const cachedAnalytics = useWorkspaceDataStore(
    (state) => state.shipmentAnalytics[analyticsKey],
  );
  const analyticsStatus = useWorkspaceDataStore(
    (state) => state.shipmentAnalyticsStatuses[analyticsKey] ?? "idle",
  );
  const analyticsError = useWorkspaceDataStore(
    (state) => state.shipmentAnalyticsErrors[analyticsKey] ?? null,
  );
  const usesDefaultAnalytics =
    analyticsGranularity === "month" &&
    !analyticsStartDate &&
    !analyticsEndDate &&
    analyticsModes.length === 0;
  const activeShipmentAnalysis = usesDefaultAnalytics
    ? shipmentData?.analysis
    : (cachedAnalytics ?? shipmentData?.analysis);
  const overviewAnalysis = shipmentData?.analysis ?? null;
  const hasOverviewData = Boolean(overviewAnalysis?.shipment_count);
  const shipmentError = localShipmentError ?? cachedShipmentError;
  const visibleEvidenceError = evidenceError ?? cachedSuppliersError;
  const isLoadingShipments =
    shipmentsStatus === "loading" && shipmentData === null;
  const isLoadingSuppliers =
    suppliersStatus === "loading" && suppliers.length === 0;

  useEffect(() => {
    if (
      section !== "overview" &&
      section !== "shipments" &&
      section !== "scenarios"
    )
      return;
    void ensureShipments().catch(() => undefined);
  }, [ensureShipments, section, session.workspace_id]);

  useEffect(() => {
    if (section !== "overview") return;
    void ensureArtifacts().catch(() => undefined);
  }, [ensureArtifacts, section, session.workspace_id]);

  useEffect(() => {
    if (section !== "shipments" || usesDefaultAnalytics) return;
    void ensureShipmentAnalytics(analyticsQuery).catch(() => undefined);
  }, [
    analyticsKey,
    analyticsQuery,
    ensureShipmentAnalytics,
    section,
    usesDefaultAnalytics,
  ]);

  useEffect(() => {
    if (section !== "evidence") return;
    void ensureSuppliers().catch(() => undefined);
  }, [ensureSuppliers, section, session.workspace_id]);

  function selectShipmentFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setShipmentError(null);
    setShipmentImportIssues([]);
  }

  function dropShipmentFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingShipmentFile(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) {
      setSelectedFile(file);
      setShipmentError(null);
      setShipmentImportIssues([]);
    }
  }

  function closeShipmentImport() {
    if (isUploading) return;
    setIsShipmentModalOpen(false);
    setIsDraggingShipmentFile(false);
    setSelectedFile(null);
    setShipmentError(null);
    setShipmentImportIssues([]);
    if (shipmentInputRef.current) shipmentInputRef.current.value = "";
  }

  async function loadDemoData() {
    setIsLoadingDemoData(true);
    setDemoLoadError(null);
    try {
      await loadWorkspaceDemoData();
      await refreshSession();
      router.refresh();
    } catch (requestError) {
      setDemoLoadError(
        requestError instanceof Error
          ? requestError.message
          : "Demo data could not be loaded.",
      );
    } finally {
      setIsLoadingDemoData(false);
    }
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
      const payload = await uploadWorkspaceShipments(selectedFile);
      if (payload.accepted_rows > 0) {
        setShipmentImportIssues([]);
        setSelectedFile(null);
        if (shipmentInputRef.current) shipmentInputRef.current.value = "";
        setIsShipmentModalOpen(false);
      } else {
        setShipmentImportIssues(payload.errors);
        setShipmentError(
          "We couldn’t import this file. Review the file issues below.",
        );
      }
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
      await refreshAfterEvidenceMutation();
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

  const modeBreakdown = activeShipmentAnalysis
    ? Object.entries(activeShipmentAnalysis.mode_breakdown)
    : [];
  const hotspotRows = activeShipmentAnalysis?.hotspots.slice(0, 8) ?? [];
  const orderedModes = [...modeBreakdown].sort(
    (left, right) => right[1].emissions_kg - left[1].emissions_kg,
  );
  const highestMode = orderedModes[0] ?? null;
  const highestHotspot = hotspotRows[0] ?? null;
  const highestModeSupplier = highestMode
    ? [...highestMode[1].suppliers].sort(
        (left, right) => right.emissions_kg - left.emissions_kg,
      )[0]
    : null;
  const recentArtifacts = [...artifacts]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    )
    .slice(0, 4);

  return (
    <section className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
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
            className="rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85"
          >
            Add supplier
          </button>
        ) : null}
        {section === "shipments" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShipmentError(null);
                setShipmentImportIssues([]);
                setIsShipmentModalOpen(true);
              }}
              className="rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-primary transition hover:border-accent"
            >
              Import shipments
            </button>
            <Link
              href="/dashboard/agent"
              className="rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85"
            >
              Calculate freight
            </Link>
          </div>
        ) : null}
      </header>

      {section === "overview" ? (
        <div className="space-y-4">
          {!hasOverviewData ? (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-primary">
                  No shipment data yet
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Load the fictional dataset or import a CSV/XLSX workbook to
                  populate the dashboard. The empty cards below show what will
                  become available.
                </p>
                {demoLoadError ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                  >
                    {demoLoadError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadDemoData()}
                  disabled={isLoadingDemoData}
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-primary hover:border-accent"
                >
                  Import shipments
                </Link>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Current baseline
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-primary">
                    Carbon metrics
                  </h2>
                </div>
                <span className="rounded-lg bg-secondary/10 p-2 text-brand-primary">
                  <PackageCheck aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <dl className="mt-4 divide-y divide-border">
                <div className="py-3 first:pt-0">
                  <dt className="text-xs text-muted-foreground">
                    Total emissions
                  </dt>
                  <dd className="mt-1 text-xl font-bold tracking-tight text-primary">
                    <AnimatedNumber
                      value={overviewAnalysis?.total_emissions_kg ?? 0}
                      maximumFractionDigits={1}
                      suffix=" kg CO₂e"
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Truck aria-hidden="true" className="h-3.5 w-3.5" />
                    Shipments
                  </dt>
                  <dd className="text-base font-semibold text-primary">
                    <AnimatedNumber
                      value={overviewAnalysis?.shipment_count ?? 0}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Weight aria-hidden="true" className="h-3.5 w-3.5" />
                    Freight weight
                  </dt>
                  <dd className="text-base font-semibold text-primary">
                    <AnimatedNumber
                      value={overviewAnalysis?.total_weight_kg ?? 0}
                      maximumFractionDigits={0}
                      suffix=" kg"
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Files aria-hidden="true" className="h-3.5 w-3.5" />
                    Active artifacts
                  </dt>
                  <dd className="text-base font-semibold text-primary">
                    <AnimatedNumber value={artifacts.length} />
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                    Emissions trajectory
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-primary">
                    Monthly freight footprint
                  </h2>
                </div>
                <Link
                  href="/dashboard/shipments"
                  aria-label="Explore shipment analytics"
                  className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-accent hover:text-primary"
                >
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-3">
                {overviewAnalysis && hasOverviewData ? (
                  <ShipmentTrendChart
                    analysis={overviewAnalysis}
                    variant="area"
                    height={250}
                  />
                ) : (
                  <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-4 text-center text-xs text-muted-foreground">
                    No emissions trend yet
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Mode distribution
                </p>
                <h2 className="mt-1 text-base font-semibold text-primary">
                  Aggregate emissions mix
                </h2>
              </div>
              {overviewAnalysis && hasOverviewData ? (
                <ShipmentModeDonutChart
                  analysis={overviewAnalysis}
                  height={180}
                />
              ) : (
                <div className="flex h-[180px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  No mode distribution yet
                </div>
              )}
              <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
                {orderedModes.length
                  ? orderedModes.map(([mode, values]) => (
                      <li key={mode} className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: modeColor(mode) }}
                          />
                          <span className="truncate capitalize">{mode}</span>
                        </div>
                        <p className="mt-0.5 pl-3.5 text-xs font-semibold text-primary">
                          {overviewAnalysis?.total_emissions_kg
                            ? `${((values.emissions_kg / overviewAnalysis.total_emissions_kg) * 100).toFixed(0)}%`
                            : "0%"}
                        </p>
                      </li>
                    ))
                  : dashboardModes.map((mode) => (
                      <li key={mode} className="min-w-0 opacity-65">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: modeColor(mode) }}
                          />
                          <span className="truncate capitalize">{mode}</span>
                        </div>
                        <p className="mt-0.5 pl-3.5 text-xs font-semibold text-muted-foreground">
                          0%
                        </p>
                      </li>
                    ))}
              </ul>
              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                Totals combine each shipment&apos;s payload, route distance, and
                transport intensity.
              </p>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Workspace activity
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-primary">
                    Recent artifacts
                  </h2>
                </div>
                <Link
                  href="/dashboard/artifacts"
                  className="text-xs font-semibold text-accent hover:text-primary"
                >
                  View all
                </Link>
              </div>
              {artifactsStatus === "loading" && !recentArtifacts.length ? (
                <div className="flex min-h-52 items-center justify-center">
                  <Spinner label="Loading artifacts" />
                </div>
              ) : recentArtifacts.length ? (
                <ul className="mt-4 divide-y divide-border">
                  {recentArtifacts.map((artifact) => (
                    <li key={artifact.artifact_id}>
                      <Link
                        href={`/dashboard/artifacts?artifact=${artifact.artifact_id}`}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 hover:text-accent"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-primary">
                            {artifact.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {artifactKindLabels[artifact.kind]} · version{" "}
                            {artifact.version}
                          </span>
                        </span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  No active artifacts yet.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-sm xl:col-span-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Decision signals
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-primary">
                    Highest-impact shipments
                  </h2>
                </div>
                {highestMode ? (
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {highestMode[0]} leads
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
                {overviewAnalysis && hasOverviewData ? (
                  <ShipmentHotspotChart
                    hotspots={overviewAnalysis.hotspots}
                    height={230}
                  />
                ) : (
                  <div className="flex h-[230px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-4 text-center text-xs text-muted-foreground">
                    No shipment hotspots yet
                  </div>
                )}
                <dl className="divide-y divide-border rounded-lg bg-muted/45 px-3">
                  <div className="py-3">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Largest footprint
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-primary">
                      {highestHotspot?.shipment_id ?? "—"}
                    </dd>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {highestHotspot
                        ? `${highestHotspot.emissions_kg.toFixed(1)} kg CO₂e`
                        : "No shipment data"}
                    </p>
                  </div>
                  <div className="py-3">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Highest mode
                    </dt>
                    <dd className="mt-1 text-sm font-semibold capitalize text-primary">
                      {highestMode?.[0] ?? "—"}
                    </dd>
                  </div>
                  <div className="py-3">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Leading supplier
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-primary">
                      {highestModeSupplier?.supplier_name ?? "Not linked"}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {section === "artifacts" ? (
        <ArtifactCatalog focusedArtifactId={focusedArtifactId} />
      ) : null}

      {section === "shipments" ? (
        <section id="shipments" className="space-y-6">
          {isShipmentModalOpen ? (
            <>
              <button
                type="button"
                aria-label="Close import shipments dialog"
                onClick={closeShipmentImport}
                className="fixed inset-0 z-[60] cursor-default bg-black/35 backdrop-blur-[1px]"
              />
              <form
                onSubmit={uploadShipments}
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-shipments-title"
                className="fixed left-1/2 top-1/2 z-[70] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="import-shipments-title"
                      className="text-xl font-semibold text-primary"
                    >
                      Import shipments
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Upload a CSV or XLSX workbook. CarbonSage will normalize
                      common column names and keep any row-level issues visible.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeShipmentImport}
                    disabled={isUploading}
                    aria-label="Close dialog"
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>

                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingShipmentFile(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      setIsDraggingShipmentFile(false);
                    }
                  }}
                  onDrop={dropShipmentFile}
                  className={`mt-5 flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-5 py-9 text-center transition ${
                    isDraggingShipmentFile
                      ? "border-accent bg-accent/10"
                      : "border-border bg-muted/45 hover:border-accent hover:bg-accent/5"
                  }`}
                >
                  <input
                    ref={shipmentInputRef}
                    type="file"
                    aria-label="Shipment file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={selectShipmentFile}
                    className="sr-only"
                  />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-secondary">
                    <UploadCloud aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="mt-4 text-sm font-semibold text-primary">
                    {selectedFile
                      ? selectedFile.name
                      : "Drop a shipment file here"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    CSV or XLSX · up to 500 rows · 10 MB
                  </span>
                  <span className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm">
                    Browse files
                  </span>
                </label>

                {shipmentError ? (
                  <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {shipmentError}
                  </p>
                ) : null}
                {shipmentImportIssues.length ? (
                  <ul className="mt-3 max-h-28 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-amber-900">
                    {shipmentImportIssues.slice(0, 8).map((issue, index) => (
                      <li key={`${issue.row_number}-${issue.field}-${index}`}>
                        {issue.row_number ? `Row ${issue.row_number}: ` : ""}
                        {issue.field ? `${issue.field} — ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <a
                    href={`${getBackendUrl()}/shipments/template`}
                    className="text-sm font-semibold text-secondary hover:text-accent"
                  >
                    Download XLSX template
                  </a>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeShipmentImport}
                      disabled={isUploading}
                      className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !selectedFile}
                      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploading ? <Spinner /> : null}
                      Upload and analyze
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Shipments</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {activeShipmentAnalysis?.shipment_count ?? 0}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total emissions</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {(activeShipmentAnalysis?.total_emissions_kg ?? 0).toFixed(2)}{" "}
                kg CO₂e
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Freight weight</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {(activeShipmentAnalysis?.total_weight_kg ?? 0).toFixed(2)} kg
              </p>
            </article>
          </div>

          {shipmentData?.accepted_rows ? (
            <section
              aria-label="Shipment analytics filters"
              className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
            >
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Group by
                <select
                  value={analyticsGranularity}
                  onChange={(event) =>
                    setAnalyticsGranularity(
                      event.target.value as "month" | "year",
                    )
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary"
                >
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                From
                <input
                  type="date"
                  value={analyticsStartDate}
                  min={
                    shipmentData.analysis.available_filters.start_date ??
                    undefined
                  }
                  max={
                    analyticsEndDate ||
                    shipmentData.analysis.available_filters.end_date ||
                    undefined
                  }
                  onChange={(event) =>
                    setAnalyticsStartDate(event.target.value)
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                To
                <input
                  type="date"
                  value={analyticsEndDate}
                  min={
                    analyticsStartDate ||
                    shipmentData.analysis.available_filters.start_date ||
                    undefined
                  }
                  max={
                    shipmentData.analysis.available_filters.end_date ??
                    undefined
                  }
                  onChange={(event) => setAnalyticsEndDate(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary"
                />
              </label>
              <fieldset className="flex flex-wrap gap-1.5">
                <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                  Modes
                </legend>
                {shipmentData.analysis.available_filters.modes.map((mode) => {
                  const selected = analyticsModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAnalyticsModes((current) =>
                          selected
                            ? current.filter((item) => item !== mode)
                            : [...current, mode],
                        )
                      }
                      className={`rounded-lg border px-2.5 py-2 text-xs font-semibold capitalize transition ${
                        selected
                          ? "border-secondary bg-secondary text-white"
                          : "border-border bg-background text-primary hover:border-accent"
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </fieldset>
              {!usesDefaultAnalytics ? (
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsGranularity("month");
                    setAnalyticsStartDate("");
                    setAnalyticsEndDate("");
                    setAnalyticsModes([]);
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-secondary hover:bg-muted"
                >
                  Clear filters
                </button>
              ) : null}
              {analyticsStatus === "loading" && !usesDefaultAnalytics ? (
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner /> Updating charts
                </span>
              ) : null}
            </section>
          ) : null}

          {analyticsError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {analyticsError}
            </p>
          ) : null}

          {shipmentError && !isShipmentModalOpen ? (
            <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {shipmentError}
            </p>
          ) : null}

          {isLoadingShipments ? (
            <LoadingState label="Loading shipment data" />
          ) : shipmentData ? (
            <>
              {shipmentData.errors.length > 0 && !isShipmentModalOpen ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">
                    {shipmentData.accepted_rows === 0
                      ? "We couldn’t import this file"
                      : "Some rows need attention"}
                  </p>
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

              {shipmentData.accepted_rows > 0 ? (
                <>
                  {activeShipmentAnalysis?.shipment_count ? (
                    <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,1fr)]">
                      <article className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
                        <div>
                          <h3 className="font-semibold text-primary">
                            Emissions by mode over time
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Stacked {activeShipmentAnalysis.filters.granularity}{" "}
                            totals; hover or focus the chart to inspect each
                            mode.
                          </p>
                        </div>
                        <div className="mt-4">
                          <ShipmentTrendChart
                            analysis={activeShipmentAnalysis}
                          />
                        </div>
                        <details className="mt-3 rounded-lg bg-muted/55 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-primary">
                            View exact emissions values
                          </summary>
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="px-2 py-2">Period</th>
                                  {modeBreakdown.map(([mode]) => (
                                    <th
                                      key={mode}
                                      className="px-2 py-2 capitalize"
                                    >
                                      {mode}
                                    </th>
                                  ))}
                                  <th className="px-2 py-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeShipmentAnalysis.timeline.map(
                                  (period) => (
                                    <tr
                                      key={period.period}
                                      className="border-t border-border"
                                    >
                                      <td className="px-2 py-2">
                                        {period.period}
                                      </td>
                                      {modeBreakdown.map(([mode]) => (
                                        <td key={mode} className="px-2 py-2">
                                          {(
                                            period.mode_emissions_kg[mode] ?? 0
                                          ).toFixed(2)}
                                        </td>
                                      ))}
                                      <td className="px-2 py-2 font-semibold">
                                        {period.emissions_kg.toFixed(2)} kg CO₂e
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </article>

                      <article className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
                        <h3 className="font-semibold text-primary">
                          Top shipment hotspots
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Highest-emitting routes within the active filters.
                        </p>
                        <div className="mt-4">
                          <ShipmentHotspotChart hotspots={hotspotRows} />
                        </div>
                        <details className="mt-3 rounded-lg bg-muted/55 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-primary">
                            View exact hotspot values
                          </summary>
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="px-2 py-2">Shipment</th>
                                  <th className="px-2 py-2">Date</th>
                                  <th className="px-2 py-2">Supplier</th>
                                  <th className="px-2 py-2">Route</th>
                                  <th className="px-2 py-2">Emissions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hotspotRows.map((hotspot) => (
                                  <tr
                                    key={hotspot.shipment_id}
                                    className="border-t border-border"
                                  >
                                    <td className="px-2 py-2 font-semibold">
                                      {hotspot.shipment_id}
                                    </td>
                                    <td className="px-2 py-2">
                                      {hotspot.shipment_date ?? "Undated"}
                                    </td>
                                    <td className="px-2 py-2">
                                      {hotspot.supplier_name ?? "Not provided"}
                                    </td>
                                    <td className="px-2 py-2">
                                      {hotspot.origin} → {hotspot.destination}
                                    </td>
                                    <td className="px-2 py-2">
                                      {hotspot.emissions_kg.toFixed(2)} kg CO₂e
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </article>
                    </div>
                  ) : analyticsStatus === "loading" ? (
                    <LoadingState label="Updating shipment analytics" />
                  ) : (
                    <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
                      No shipment rows match the active filters.
                    </p>
                  )}

                  <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-background">
                    <table className="min-w-full text-left text-sm">
                      <caption className="sr-only">
                        Normalized shipment rows
                      </caption>
                      <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Shipment</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Supplier</th>
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
                              {row.shipment_date ?? "Undated"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {row.supplier_name ?? "Not provided"}
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
                    Factor source: {activeShipmentAnalysis?.factor_source} ·
                    version {activeShipmentAnalysis?.factor_version}.{" "}
                    {activeShipmentAnalysis?.factor_applicability}
                  </p>
                </>
              ) : null}
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
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isEvidenceUploading ? <Spinner /> : null}
                    Add supplier
                  </button>
                  <span className="ml-3 text-xs text-muted-foreground">
                    Attached documents: max 10 MB
                  </span>
                </div>
              </form>
            </>
          ) : null}

          {visibleEvidenceError ? (
            <p className="order-1 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {visibleEvidenceError}
            </p>
          ) : null}

          <div className="order-4 mt-7">
            <h3 className="font-semibold text-primary">Supplier cards</h3>
            {isLoadingSuppliers ? (
              <LoadingState label="Loading suppliers" />
            ) : suppliers.length === 0 ? (
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
                className="inline-flex items-center gap-2 rounded-lg border border-secondary px-3.5 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white disabled:cursor-wait disabled:opacity-60"
              >
                {isSearchingEvidence ? <Spinner /> : null}
                Search citations
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
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRunningScenario ? <Spinner /> : null}
              Run scenario
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
