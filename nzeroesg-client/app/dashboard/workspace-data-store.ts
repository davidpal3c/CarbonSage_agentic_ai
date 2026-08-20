"use client";

import { create } from "zustand";

import { getBackendUrl } from "@/app/api/urls";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type DemoDataStatus = {
  loaded: boolean;
  has_artifacts: boolean;
  artifact_count: number;
  shipment_count: number;
  supplier_count: number;
  evidence_document_count: number;
};

export type ShipmentRow = {
  shipment_id: string;
  shipment_date: string | null;
  supplier_name: string | null;
  origin: string;
  destination: string;
  weight_kg: number;
  distance_km: number;
  transport_method: string;
  source_row: number;
};

export type ShipmentAnalysis = {
  shipment_count: number;
  workspace_shipment_count: number;
  filtered_out_count: number;
  undated_shipment_count: number;
  total_weight_kg: number;
  total_emissions_kg: number;
  total_emissions_tonnes: number;
  mode_breakdown: Record<
    string,
    {
      shipment_count: number;
      weight_kg: number;
      emissions_kg: number;
      suppliers: Array<{
        supplier_name: string | null;
        shipment_count: number;
        emissions_kg: number;
      }>;
    }
  >;
  timeline: Array<{
    period: string;
    period_start: string | null;
    shipment_count: number;
    weight_kg: number;
    emissions_kg: number;
    mode_emissions_kg: Record<string, number>;
  }>;
  hotspots: Array<{
    shipment_id: string;
    shipment_date: string | null;
    supplier_name: string | null;
    origin: string;
    destination: string;
    transport_method: string;
    emissions_kg: number;
  }>;
  filters: {
    granularity: "month" | "year";
    start_date: string | null;
    end_date: string | null;
    modes: string[];
  };
  available_filters: {
    start_date: string | null;
    end_date: string | null;
    modes: string[];
  };
  warnings: string[];
  factor_source: string;
  factor_version: string;
  factor_applicability: string;
  assumptions: string[];
};

export type ShipmentData = {
  artifact?: Artifact | null;
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

export type ShipmentAnalyticsQuery = {
  granularity?: "month" | "year";
  startDate?: string;
  endDate?: string;
  modes?: string[];
};

export type SupplierCard = {
  supplier_id: string;
  name: string;
  region: string | null;
  certifications: string[];
  transport_modes: string[];
  document_count: number;
  missing_fields: string[];
};

export type ArtifactKind =
  | "shipment_dataset"
  | "evidence_document"
  | "report_snapshot";

export type Artifact = {
  artifact_id: string;
  workspace_id: string;
  kind: ArtifactKind;
  title: string;
  status: "processing" | "ready" | "failed";
  source_type:
    | "local_upload"
    | "generated"
    | "google_drive"
    | "legacy_migration";
  source_reference: string | null;
  media_type: string | null;
  content_sha256: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ModeBreakdown = {
  shipment_count: number;
  weight_kg: number;
  emissions_kg: number;
};

export type ReportData = {
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

type WorkspaceData = {
  workspaceId: string | null;
  demoData: DemoDataStatus | null;
  demoStatus: LoadStatus;
  demoError: string | null;
  shipments: ShipmentData | null;
  shipmentsStatus: LoadStatus;
  shipmentsError: string | null;
  shipmentAnalytics: Record<string, ShipmentAnalysis>;
  shipmentAnalyticsStatuses: Record<string, LoadStatus>;
  shipmentAnalyticsErrors: Record<string, string | null>;
  suppliers: SupplierCard[];
  suppliersStatus: LoadStatus;
  suppliersError: string | null;
  artifacts: Artifact[];
  artifactsStatus: LoadStatus;
  artifactsError: string | null;
  reports: Record<string, ReportData>;
  reportStatuses: Record<string, LoadStatus>;
  reportErrors: Record<string, string | null>;
};

type WorkspaceDataActions = {
  setWorkspace: (workspaceId: string) => void;
  resetWorkspace: () => void;
  ensureDemoData: (force?: boolean) => Promise<DemoDataStatus>;
  loadDemoData: () => Promise<DemoDataStatus>;
  unloadDemoData: () => Promise<DemoDataStatus>;
  ensureShipments: (force?: boolean) => Promise<ShipmentData>;
  ensureShipmentAnalytics: (
    query?: ShipmentAnalyticsQuery,
    force?: boolean,
  ) => Promise<ShipmentAnalysis>;
  uploadShipments: (file: File) => Promise<ShipmentData>;
  ensureSuppliers: (force?: boolean) => Promise<SupplierCard[]>;
  ensureArtifacts: (force?: boolean) => Promise<Artifact[]>;
  ensureReport: (mode: string, force?: boolean) => Promise<ReportData>;
  refreshAfterEvidenceMutation: () => Promise<void>;
  refreshAfterReportSnapshot: () => Promise<void>;
  renameArtifact: (artifactId: string, title: string) => Promise<Artifact>;
  deleteArtifact: (artifact: Artifact) => Promise<void>;
};

type WorkspaceDataStore = WorkspaceData & WorkspaceDataActions;

function emptyWorkspaceData(workspaceId: string | null = null): WorkspaceData {
  return {
    workspaceId,
    demoData: null,
    demoStatus: "idle",
    demoError: null,
    shipments: null,
    shipmentsStatus: "idle",
    shipmentsError: null,
    shipmentAnalytics: {},
    shipmentAnalyticsStatuses: {},
    shipmentAnalyticsErrors: {},
    suppliers: [],
    suppliersStatus: "idle",
    suppliersError: null,
    artifacts: [],
    artifactsStatus: "idle",
    artifactsError: null,
    reports: {},
    reportStatuses: {},
    reportErrors: {},
  };
}

type RequestKey = "demo" | "shipments" | "suppliers" | "artifacts";

const inFlight = new Map<string, Promise<unknown>>();
let requestEpoch = 0;

function requestKey(
  workspaceId: string,
  resource: RequestKey | `report:${string}` | `analytics:${string}`,
) {
  return `${workspaceId}:${resource}`;
}

export function shipmentAnalyticsKey(query: ShipmentAnalyticsQuery = {}) {
  const modes = [...(query.modes ?? [])].sort();
  return [
    query.granularity ?? "month",
    query.startDate ?? "",
    query.endDate ?? "",
    modes.join(","),
  ].join("|");
}

function clearRequests() {
  inFlight.clear();
  requestEpoch += 1;
}

async function responseDetail(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    detail?: string;
  } | null;
  return payload?.detail ?? fallback;
}

function requireWorkspace(workspaceId: string | null): string {
  if (!workspaceId) throw new Error("The workspace is not ready yet.");
  return workspaceId;
}

export const useWorkspaceDataStore = create<WorkspaceDataStore>((set, get) => ({
  ...emptyWorkspaceData(),

  setWorkspace(workspaceId) {
    if (get().workspaceId === workspaceId) return;
    clearRequests();
    set(emptyWorkspaceData(workspaceId));
  },

  resetWorkspace() {
    clearRequests();
    set(emptyWorkspaceData());
  },

  async ensureDemoData(force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    if (!force && get().demoStatus === "ready" && get().demoData) {
      return get().demoData as DemoDataStatus;
    }
    const key = requestKey(workspaceId, "demo");
    const existing = inFlight.get(key) as Promise<DemoDataStatus> | undefined;
    if (existing) return existing;

    const epoch = requestEpoch;
    set({ demoStatus: "loading", demoError: null });
    const request = fetch(`${getBackendUrl()}/demo/data`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "Workspace data status is unavailable.",
            ),
          );
        }
        return (await response.json()) as DemoDataStatus;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({ demoData: payload, demoStatus: "ready", demoError: null });
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            demoStatus: "error",
            demoError:
              error instanceof Error
                ? error.message
                : "Workspace data status is unavailable.",
          });
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async loadDemoData() {
    const workspaceId = requireWorkspace(get().workspaceId);
    clearRequests();
    const epoch = requestEpoch;
    set({ demoStatus: "loading", demoError: null });
    try {
      const response = await fetch(`${getBackendUrl()}/demo/data`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(
          await responseDetail(response, "Demo data could not be loaded."),
        );
      }
      const payload = (await response.json()) as DemoDataStatus;
      if (get().workspaceId === workspaceId && requestEpoch === epoch) {
        set({
          demoData: payload,
          demoStatus: "ready",
          demoError: null,
          shipmentsStatus: "idle",
          shipmentAnalytics: {},
          shipmentAnalyticsStatuses: {},
          shipmentAnalyticsErrors: {},
          suppliersStatus: "idle",
          artifactsStatus: "idle",
          reports: {},
          reportStatuses: {},
          reportErrors: {},
        });
        await Promise.allSettled([
          get().ensureShipments(true),
          get().ensureSuppliers(true),
          get().ensureArtifacts(true),
        ]);
      }
      return payload;
    } catch (error) {
      if (get().workspaceId === workspaceId && requestEpoch === epoch) {
        set({
          demoStatus: "error",
          demoError:
            error instanceof Error
              ? error.message
              : "Demo data could not be loaded.",
        });
      }
      throw error;
    }
  },

  async unloadDemoData() {
    const workspaceId = requireWorkspace(get().workspaceId);
    clearRequests();
    const epoch = requestEpoch;
    set({ demoStatus: "loading", demoError: null });
    try {
      const response = await fetch(`${getBackendUrl()}/demo/data`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(
          await responseDetail(response, "Demo data could not be removed."),
        );
      }
      const payload = (await response.json()) as DemoDataStatus;
      if (get().workspaceId === workspaceId && requestEpoch === epoch) {
        set({
          demoData: payload,
          demoStatus: "ready",
          demoError: null,
          shipments: null,
          shipmentsStatus: "idle",
          shipmentAnalytics: {},
          shipmentAnalyticsStatuses: {},
          shipmentAnalyticsErrors: {},
          suppliersStatus: "idle",
          artifactsStatus: "idle",
          reports: {},
          reportStatuses: {},
          reportErrors: {},
        });
        await Promise.allSettled([
          get().ensureShipments(true),
          get().ensureSuppliers(true),
          get().ensureArtifacts(true),
        ]);
      }
      return payload;
    } catch (error) {
      if (get().workspaceId === workspaceId && requestEpoch === epoch) {
        set({
          demoStatus: "error",
          demoError:
            error instanceof Error
              ? error.message
              : "Demo data could not be removed.",
        });
      }
      throw error;
    }
  },

  async ensureShipments(force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    if (!force && get().shipmentsStatus === "ready" && get().shipments) {
      return get().shipments as ShipmentData;
    }
    const key = requestKey(workspaceId, "shipments");
    const existing = inFlight.get(key) as Promise<ShipmentData> | undefined;
    if (existing) return existing;
    const epoch = requestEpoch;
    set({ shipmentsStatus: "loading", shipmentsError: null });
    const request = fetch(`${getBackendUrl()}/shipments`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "Shipment data could not be loaded.",
            ),
          );
        }
        return (await response.json()) as ShipmentData;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          const analyticsKey = shipmentAnalyticsKey();
          set((state) => ({
            shipments: payload,
            shipmentsStatus: "ready",
            shipmentsError: null,
            shipmentAnalytics: {
              ...state.shipmentAnalytics,
              [analyticsKey]: payload.analysis,
            },
            shipmentAnalyticsStatuses: {
              ...state.shipmentAnalyticsStatuses,
              [analyticsKey]: "ready",
            },
            shipmentAnalyticsErrors: {
              ...state.shipmentAnalyticsErrors,
              [analyticsKey]: null,
            },
          }));
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            shipmentsStatus: "error",
            shipmentsError:
              error instanceof Error
                ? error.message
                : "Shipment data could not be loaded.",
          });
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async ensureShipmentAnalytics(query = {}, force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    const analyticsKey = shipmentAnalyticsKey(query);
    if (
      !force &&
      get().shipmentAnalyticsStatuses[analyticsKey] === "ready" &&
      get().shipmentAnalytics[analyticsKey]
    ) {
      return get().shipmentAnalytics[analyticsKey];
    }
    const key = requestKey(workspaceId, `analytics:${analyticsKey}`);
    const existing = inFlight.get(key) as Promise<ShipmentAnalysis> | undefined;
    if (existing) return existing;

    const parameters = new URLSearchParams({
      granularity: query.granularity ?? "month",
    });
    if (query.startDate) parameters.set("start_date", query.startDate);
    if (query.endDate) parameters.set("end_date", query.endDate);
    for (const mode of [...(query.modes ?? [])].sort()) {
      parameters.append("mode", mode);
    }
    const epoch = requestEpoch;
    set((state) => ({
      shipmentAnalyticsStatuses: {
        ...state.shipmentAnalyticsStatuses,
        [analyticsKey]: "loading",
      },
      shipmentAnalyticsErrors: {
        ...state.shipmentAnalyticsErrors,
        [analyticsKey]: null,
      },
    }));
    const request = fetch(
      `${getBackendUrl()}/shipments/analytics?${parameters.toString()}`,
      { credentials: "include" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "Shipment analytics could not be loaded.",
            ),
          );
        }
        return (await response.json()) as ShipmentAnalysis;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set((state) => ({
            shipmentAnalytics: {
              ...state.shipmentAnalytics,
              [analyticsKey]: payload,
            },
            shipmentAnalyticsStatuses: {
              ...state.shipmentAnalyticsStatuses,
              [analyticsKey]: "ready",
            },
            shipmentAnalyticsErrors: {
              ...state.shipmentAnalyticsErrors,
              [analyticsKey]: null,
            },
          }));
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set((state) => ({
            shipmentAnalyticsStatuses: {
              ...state.shipmentAnalyticsStatuses,
              [analyticsKey]: "error",
            },
            shipmentAnalyticsErrors: {
              ...state.shipmentAnalyticsErrors,
              [analyticsKey]:
                error instanceof Error
                  ? error.message
                  : "Shipment analytics could not be loaded.",
            },
          }));
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async uploadShipments(file) {
    const workspaceId = requireWorkspace(get().workspaceId);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${getBackendUrl()}/shipments/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(
        await responseDetail(response, "Shipment data could not be uploaded."),
      );
    }
    const payload = (await response.json()) as ShipmentData;
    if (get().workspaceId !== workspaceId) {
      throw new Error("The active workspace changed during upload.");
    }
    const analyticsKey = shipmentAnalyticsKey();
    set({
      shipments: payload,
      shipmentsStatus: "ready",
      shipmentsError: null,
      shipmentAnalytics: { [analyticsKey]: payload.analysis },
      shipmentAnalyticsStatuses: { [analyticsKey]: "ready" },
      shipmentAnalyticsErrors: { [analyticsKey]: null },
    });
    if (payload.accepted_rows > 0) {
      clearRequests();
      set({
        artifactsStatus: "idle",
        demoStatus: "idle",
        reports: {},
        reportStatuses: {},
        reportErrors: {},
      });
      await Promise.allSettled([
        get().ensureArtifacts(true),
        get().ensureDemoData(true),
      ]);
    }
    return payload;
  },

  async ensureSuppliers(force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    if (!force && get().suppliersStatus === "ready") return get().suppliers;
    const key = requestKey(workspaceId, "suppliers");
    const existing = inFlight.get(key) as Promise<SupplierCard[]> | undefined;
    if (existing) return existing;
    const epoch = requestEpoch;
    set({ suppliersStatus: "loading", suppliersError: null });
    const request = fetch(`${getBackendUrl()}/suppliers`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "Supplier evidence could not be loaded.",
            ),
          );
        }
        const payload = (await response.json()) as {
          suppliers: SupplierCard[];
        };
        return payload.suppliers;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            suppliers: payload,
            suppliersStatus: "ready",
            suppliersError: null,
          });
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            suppliersStatus: "error",
            suppliersError:
              error instanceof Error
                ? error.message
                : "Supplier evidence could not be loaded.",
          });
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async ensureArtifacts(force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    if (!force && get().artifactsStatus === "ready") return get().artifacts;
    const key = requestKey(workspaceId, "artifacts");
    const existing = inFlight.get(key) as Promise<Artifact[]> | undefined;
    if (existing) return existing;
    const epoch = requestEpoch;
    set({ artifactsStatus: "loading", artifactsError: null });
    const request = fetch(`${getBackendUrl()}/artifacts`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "Workspace artifacts could not be loaded.",
            ),
          );
        }
        const payload = (await response.json()) as { artifacts: Artifact[] };
        return payload.artifacts;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            artifacts: payload,
            artifactsStatus: "ready",
            artifactsError: null,
          });
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set({
            artifactsStatus: "error",
            artifactsError:
              error instanceof Error
                ? error.message
                : "Workspace artifacts could not be loaded.",
          });
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async ensureReport(mode, force = false) {
    const workspaceId = requireWorkspace(get().workspaceId);
    if (
      !force &&
      get().reportStatuses[mode] === "ready" &&
      get().reports[mode]
    ) {
      return get().reports[mode];
    }
    const key = requestKey(workspaceId, `report:${mode}`);
    const existing = inFlight.get(key) as Promise<ReportData> | undefined;
    if (existing) return existing;
    const epoch = requestEpoch;
    set((state) => ({
      reportStatuses: { ...state.reportStatuses, [mode]: "loading" },
      reportErrors: { ...state.reportErrors, [mode]: null },
    }));
    const query = mode ? `?alternative_mode=${encodeURIComponent(mode)}` : "";
    const request = fetch(`${getBackendUrl()}/reports/preview${query}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseDetail(
              response,
              "The report preview could not be loaded.",
            ),
          );
        }
        return (await response.json()) as ReportData;
      })
      .then((payload) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set((state) => ({
            reports: { ...state.reports, [mode]: payload },
            reportStatuses: { ...state.reportStatuses, [mode]: "ready" },
            reportErrors: { ...state.reportErrors, [mode]: null },
          }));
        }
        return payload;
      })
      .catch((error: unknown) => {
        if (get().workspaceId === workspaceId && requestEpoch === epoch) {
          set((state) => ({
            reportStatuses: { ...state.reportStatuses, [mode]: "error" },
            reportErrors: {
              ...state.reportErrors,
              [mode]:
                error instanceof Error
                  ? error.message
                  : "The report preview could not be loaded.",
            },
          }));
        }
        throw error;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  },

  async refreshAfterEvidenceMutation() {
    clearRequests();
    set({
      suppliersStatus: "idle",
      artifactsStatus: "idle",
      demoStatus: "idle",
      reports: {},
      reportStatuses: {},
      reportErrors: {},
    });
    await Promise.allSettled([
      get().ensureSuppliers(true),
      get().ensureArtifacts(true),
      get().ensureDemoData(true),
    ]);
  },

  async refreshAfterReportSnapshot() {
    await get().ensureArtifacts(true);
  },

  async renameArtifact(artifactId, title) {
    const response = await fetch(`${getBackendUrl()}/artifacts/${artifactId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error(
        await responseDetail(response, "Artifact could not be renamed."),
      );
    }
    const updated = (await response.json()) as Artifact;
    set((state) => ({
      artifacts: state.artifacts.map((artifact) =>
        artifact.artifact_id === updated.artifact_id ? updated : artifact,
      ),
    }));
    return updated;
  },

  async deleteArtifact(artifact) {
    const response = await fetch(
      `${getBackendUrl()}/artifacts/${artifact.artifact_id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      throw new Error(
        await responseDetail(response, "Artifact could not be deleted."),
      );
    }
    clearRequests();
    set((state) => ({
      artifacts: state.artifacts.filter(
        (item) => item.artifact_id !== artifact.artifact_id,
      ),
      artifactsStatus: "ready",
      shipments: artifact.kind === "shipment_dataset" ? null : state.shipments,
      shipmentsStatus:
        artifact.kind === "shipment_dataset" ? "idle" : state.shipmentsStatus,
      shipmentAnalytics:
        artifact.kind === "shipment_dataset" ? {} : state.shipmentAnalytics,
      shipmentAnalyticsStatuses:
        artifact.kind === "shipment_dataset"
          ? {}
          : state.shipmentAnalyticsStatuses,
      shipmentAnalyticsErrors:
        artifact.kind === "shipment_dataset"
          ? {}
          : state.shipmentAnalyticsErrors,
      suppliersStatus:
        artifact.kind === "evidence_document" ? "idle" : state.suppliersStatus,
      demoStatus: "idle",
      reports: {},
      reportStatuses: {},
      reportErrors: {},
    }));
    const refreshes: Promise<unknown>[] = [get().ensureDemoData(true)];
    if (artifact.kind === "shipment_dataset") {
      refreshes.push(get().ensureShipments(true));
    }
    if (artifact.kind === "evidence_document") {
      refreshes.push(get().ensureSuppliers(true));
    }
    await Promise.allSettled(refreshes);
  },
}));
