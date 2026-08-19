"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { LoadingState, Spinner } from "@/app/components/Spinner";

export type ArtifactKind =
  | "shipment_dataset"
  | "evidence_document"
  | "report_snapshot";

type Artifact = {
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

type WorkspaceDataStatus = {
  shipment_count: number;
  supplier_count: number;
};

const kindLabels: Record<ArtifactKind, string> = {
  shipment_dataset: "Shipment dataset",
  evidence_document: "Evidence document",
  report_snapshot: "Report snapshot",
};

const sourceLabels: Record<Artifact["source_type"], string> = {
  local_upload: "Local upload",
  generated: "Generated",
  google_drive: "Google Drive",
  legacy_migration: "Migrated record",
};

type ArtifactCatalogProps = {
  refreshToken: number;
  onDeleted: (kind: ArtifactKind) => void | Promise<void>;
  focusedArtifactId?: string;
};

type SourceRetention = {
  status: "retained" | "ephemeral";
  size_bytes: number | null;
  expires_at: string | null;
};

function sourceRetentionFor(artifact: Artifact): SourceRetention | null {
  const value = artifact.metadata.source_retention;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.status !== "retained" && candidate.status !== "ephemeral") {
    return null;
  }
  return {
    status: candidate.status,
    size_bytes:
      typeof candidate.size_bytes === "number" ? candidate.size_bytes : null,
    expires_at:
      typeof candidate.expires_at === "string" ? candidate.expires_at : null,
  };
}

export default function ArtifactCatalog({
  refreshToken,
  onDeleted,
  focusedArtifactId,
}: ArtifactCatalogProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [dataStatus, setDataStatus] = useState<WorkspaceDataStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    focusedArtifactId ?? null,
  );
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    Promise.all([
      fetch(`${getBackendUrl()}/artifacts`, {
        credentials: "include",
        signal: controller.signal,
      }),
      fetch(`${getBackendUrl()}/demo/data`, {
        credentials: "include",
        signal: controller.signal,
      }),
    ])
      .then(async ([artifactResponse, statusResponse]) => {
        if (!artifactResponse.ok || !statusResponse.ok) {
          throw new Error("Workspace artifacts could not be loaded.");
        }
        return Promise.all([
          artifactResponse.json() as Promise<{ artifacts: Artifact[] }>,
          statusResponse.json() as Promise<WorkspaceDataStatus>,
        ]);
      })
      .then(([artifactPayload, statusPayload]) => {
        if (!isCurrent) return;
        setArtifacts(artifactPayload.artifacts);
        setDataStatus(statusPayload);
      })
      .catch((requestError) => {
        if (!isCurrent || controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Workspace artifacts could not be loaded.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!focusedArtifactId || !artifacts.length) return;
    document
      .getElementById(`artifact-${focusedArtifactId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [artifacts, focusedArtifactId]);

  async function renameArtifact(artifact: Artifact) {
    const title = draftTitle.trim();
    if (!title) {
      setError("Artifact title cannot be empty.");
      return;
    }
    setBusyId(artifact.artifact_id);
    setError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/artifacts/${artifact.artifact_id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      if (!response.ok) throw new Error("Artifact could not be renamed.");
      const updated = (await response.json()) as Artifact;
      setArtifacts((current) =>
        current.map((item) =>
          item.artifact_id === updated.artifact_id ? updated : item,
        ),
      );
      setEditingId(null);
      setStatusMessage(`Renamed artifact to ${updated.title}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Artifact could not be renamed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteArtifact(artifact: Artifact) {
    setMenuId(null);
    if (
      !window.confirm(
        `Delete “${artifact.title}”? Its active derived data will no longer be available.`,
      )
    ) {
      return;
    }
    setBusyId(artifact.artifact_id);
    setError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/artifacts/${artifact.artifact_id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error("Artifact could not be deleted.");
      setArtifacts((current) =>
        current.filter((item) => item.artifact_id !== artifact.artifact_id),
      );
      if (artifact.kind === "shipment_dataset") {
        setDataStatus((current) =>
          current ? { ...current, shipment_count: 0 } : current,
        );
      }
      setStatusMessage(`Deleted ${artifact.title}.`);
      await onDeleted(artifact.kind);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Artifact could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function downloadArtifact(artifact: Artifact) {
    setMenuId(null);
    setBusyId(artifact.artifact_id);
    setError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/artifacts/${artifact.artifact_id}/content`,
        { credentials: "include" },
      );
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "The retained source has expired."
            : "The retained source could not be downloaded.",
        );
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = artifact.title;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage(`Downloaded source for ${artifact.title}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The retained source could not be downloaded.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function downloadWorkspaceExport(
    path: string,
    filename: string,
    label: string,
  ) {
    setBusyExport(path);
    setError(null);
    try {
      const response = await fetch(`${getBackendUrl()}${path}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`${label} could not be downloaded.`);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage(`Downloaded ${label.toLowerCase()}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `${label} could not be downloaded.`,
      );
    } finally {
      setBusyExport(null);
    }
  }

  return (
    <section id="artifacts" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-5 sm:px-6">
        <div>
          <h2 className="text-xl font-semibold text-primary">
            Files & reports
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Uploaded sources and saved outputs in this workspace.
          </p>
        </div>
        {!isLoading ? (
          <div className="flex flex-wrap items-center gap-2">
            {dataStatus?.shipment_count ? (
              <button
                type="button"
                onClick={() =>
                  void downloadWorkspaceExport(
                    "/shipments/export",
                    "carbonsage-shipments.csv",
                    "Shipment data",
                  )
                }
                disabled={busyExport === "/shipments/export"}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-muted disabled:opacity-60"
              >
                {busyExport === "/shipments/export" ? <Spinner /> : null}
                Download shipments
              </button>
            ) : null}
            {dataStatus?.supplier_count ? (
              <button
                type="button"
                onClick={() =>
                  void downloadWorkspaceExport(
                    "/suppliers/export",
                    "carbonsage-suppliers.csv",
                    "Supplier data",
                  )
                }
                disabled={busyExport === "/suppliers/export"}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-muted disabled:opacity-60"
              >
                {busyExport === "/suppliers/export" ? <Spinner /> : null}
                Download suppliers
              </button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {artifacts.length} active
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mx-5 mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6">
          {error}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {isLoading ? (
        <LoadingState label="Loading artifacts" />
      ) : artifacts.length === 0 ? (
        <p className="m-5 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground sm:m-6">
          No active artifacts yet. Load demo data or upload shipment and
          supplier sources to begin.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {artifacts.map((artifact) => {
            const sourceRetention = sourceRetentionFor(artifact);
            const expanded = expandedId === artifact.artifact_id;
            const sourceAvailable =
              sourceRetention?.status === "retained" ||
              artifact.source_type === "generated";
            return (
              <article
                key={artifact.artifact_id}
                id={`artifact-${artifact.artifact_id}`}
                className={`relative transition ${
                  focusedArtifactId === artifact.artifact_id
                    ? "bg-accent/5 ring-1 ring-inset ring-accent/25"
                    : "bg-card"
                }`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((current) =>
                        current === artifact.artifact_id
                          ? null
                          : artifact.artifact_id,
                      )
                    }
                    aria-expanded={expanded}
                    className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left sm:px-6 md:grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                        {kindLabels[artifact.kind]}
                      </p>
                      <h3 className="mt-1 break-words text-sm font-semibold text-primary md:truncate">
                        {artifact.title}
                      </h3>
                    </div>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {sourceLabels[artifact.source_type]}
                    </span>
                    <span className="hidden text-xs text-muted-foreground md:block">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                      }).format(new Date(artifact.created_at))}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-md bg-secondary/10 px-2 py-1 text-[11px] font-semibold capitalize text-secondary">
                        {artifact.status}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>

                  <div className="relative flex items-center pr-4 sm:pr-5">
                    <button
                      type="button"
                      onClick={() =>
                        setMenuId((current) =>
                          current === artifact.artifact_id
                            ? null
                            : artifact.artifact_id,
                        )
                      }
                      aria-label={`Actions for ${artifact.title}`}
                      aria-expanded={menuId === artifact.artifact_id}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-primary"
                    >
                      {busyId === artifact.artifact_id ? (
                        <Spinner />
                      ) : (
                        <MoreHorizontal
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      )}
                    </button>
                    {menuId === artifact.artifact_id ? (
                      <div className="absolute right-4 top-12 z-20 w-44 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => void downloadArtifact(artifact)}
                          disabled={!sourceAvailable}
                          title={
                            sourceAvailable
                              ? undefined
                              : "Source bytes are not retained in this environment."
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-primary hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-55"
                        >
                          <Download aria-hidden="true" className="h-4 w-4" />
                          Download source
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(artifact.artifact_id);
                            setEditingId(artifact.artifact_id);
                            setDraftTitle(artifact.title);
                            setMenuId(null);
                            setError(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-primary hover:bg-muted"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteArtifact(artifact)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-border bg-muted/35 px-5 py-4 sm:px-6">
                    <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Source
                        </dt>
                        <dd className="mt-1 break-words text-primary">
                          {artifact.source_reference ??
                            "Generated in workspace"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Type</dt>
                        <dd className="mt-1 text-primary">
                          {sourceLabels[artifact.source_type]}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Version
                        </dt>
                        <dd className="mt-1 text-primary">
                          {artifact.version}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Source retention
                        </dt>
                        <dd className="mt-1 text-primary">
                          {sourceRetention?.status === "retained" &&
                          sourceRetention.expires_at
                            ? `Private until ${new Intl.DateTimeFormat(
                                undefined,
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                },
                              ).format(new Date(sourceRetention.expires_at))}`
                            : artifact.source_type === "generated"
                              ? "Reproducible demo source"
                              : "Not retained in this environment"}
                        </dd>
                      </div>
                    </dl>

                    {editingId === artifact.artifact_id ? (
                      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-primary">
                          Artifact title
                          <input
                            value={draftTitle}
                            onChange={(event) =>
                              setDraftTitle(event.target.value)
                            }
                            maxLength={255}
                            className="min-w-0 rounded-lg border border-border bg-card px-3 py-2 font-normal"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void renameArtifact(artifact)}
                          disabled={busyId === artifact.artifact_id}
                          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busyId === artifact.artifact_id ? <Spinner /> : null}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
