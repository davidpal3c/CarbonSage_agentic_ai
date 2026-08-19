"use client";

import { useEffect, useState } from "react";

import { getBackendUrl } from "@/app/api/urls";

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
  if (!value || typeof value !== "object") {
    return null;
  }
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    fetch(`${getBackendUrl()}/artifacts`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Workspace artifacts could not be loaded.");
        }
        return (await response.json()) as { artifacts: Artifact[] };
      })
      .then((payload) => {
        if (isCurrent) {
          setArtifacts(payload.artifacts);
        }
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Workspace artifacts could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
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
      if (!response.ok) {
        throw new Error("Artifact could not be renamed.");
      }
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
    const confirmed = window.confirm(
      `Delete “${artifact.title}”? Its active derived data will no longer be available.`,
    );
    if (!confirmed) {
      return;
    }
    setBusyId(artifact.artifact_id);
    setError(null);
    try {
      const response = await fetch(
        `${getBackendUrl()}/artifacts/${artifact.artifact_id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        throw new Error("Artifact could not be deleted.");
      }
      setArtifacts((current) =>
        current.filter((item) => item.artifact_id !== artifact.artifact_id),
      );
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
      setStatusMessage(`Downloaded retained source for ${artifact.title}.`);
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

  return (
    <section
      id="artifacts"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-primary">
            Files & reports
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Uploaded sources and saved outputs in this workspace.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${artifacts.length} active`}
        </span>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {isLoading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading files…</p>
      ) : artifacts.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          No active artifacts yet. Upload shipment data or supplier evidence to
          create the first workspace artifact.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {artifacts.map((artifact) => {
            const sourceRetention = sourceRetentionFor(artifact);
            return (
              <article
                key={artifact.artifact_id}
                id={`artifact-${artifact.artifact_id}`}
                className={`min-w-0 rounded-lg border bg-background p-4 transition ${
                  focusedArtifactId === artifact.artifact_id
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                      {kindLabels[artifact.kind]}
                    </p>
                    <h3 className="mt-1 break-words font-semibold text-primary">
                      {artifact.title}
                    </h3>
                  </div>
                  <span className="rounded-full bg-secondary/10 px-2 py-1 text-xs font-semibold capitalize text-primary">
                    {artifact.status}
                  </span>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Source</dt>
                    <dd className="break-words text-primary">
                      {sourceLabels[artifact.source_type]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd className="text-primary">
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(artifact.created_at))}
                    </dd>
                  </div>
                </dl>

                <details className="mt-4 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-semibold text-primary">
                    Source details
                  </summary>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="text-xs">Source reference</dt>
                      <dd className="break-words">
                        {artifact.source_reference ?? "Generated in workspace"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs">Version</dt>
                      <dd>{artifact.version}</dd>
                    </div>
                    <div>
                      <dt className="text-xs">Source retention</dt>
                      <dd>
                        {sourceRetention?.status === "retained" &&
                        sourceRetention.expires_at
                          ? `Private until ${new Intl.DateTimeFormat(
                              undefined,
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            ).format(new Date(sourceRetention.expires_at))}`
                          : "Not retained in this environment"}
                      </dd>
                    </div>
                  </dl>
                </details>

                {editingId === artifact.artifact_id ? (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-primary">
                      Artifact title
                      <input
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        maxLength={255}
                        className="min-w-0 rounded-lg border border-border bg-muted px-3 py-2 font-normal"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => renameArtifact(artifact)}
                      disabled={busyId === artifact.artifact_id}
                      className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Save name
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sourceRetention?.status === "retained" ? (
                      <button
                        type="button"
                        onClick={() => downloadArtifact(artifact)}
                        disabled={busyId === artifact.artifact_id}
                        className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Download source
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(artifact.artifact_id);
                        setDraftTitle(artifact.title);
                        setError(null);
                      }}
                      className="rounded-full border border-secondary px-4 py-2 text-sm font-semibold text-secondary"
                    >
                      Rename {artifact.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteArtifact(artifact)}
                      disabled={busyId === artifact.artifact_id}
                      className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                    >
                      Delete {artifact.title}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
