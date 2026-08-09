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
};

export default function ArtifactCatalog({
  refreshToken,
  onDeleted,
}: ArtifactCatalogProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
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
      });
    return () => {
      isCurrent = false;
    };
  }, [refreshToken]);

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

  return (
    <section
      id="artifacts"
      className="mt-8 rounded-xl border border-border bg-muted p-6"
    >
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent">
        Phase 7 control plane
      </p>
      <h2 className="text-2xl font-semibold text-primary">
        Workspace artifacts
      </h2>
      <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">
        Track the source, status, and provenance of uploaded datasets, supplier
        evidence, and saved decision reports. Raw files are not retained beyond
        bounded ingestion.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {artifacts.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          No active artifacts yet. Upload shipment data or supplier evidence to
          create the first workspace artifact.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {artifacts.map((artifact) => (
            <article
              key={artifact.artifact_id}
              className="min-w-0 rounded-lg border border-border bg-background p-4"
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
                  Inspect provenance
                </summary>
                <dl className="mt-3 space-y-2">
                  <div>
                    <dt className="text-xs">Artifact ID</dt>
                    <dd className="break-all font-mono text-xs">
                      {artifact.artifact_id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs">Source reference</dt>
                    <dd className="break-words">
                      {artifact.source_reference ?? "Generated in workspace"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs">Content identity</dt>
                    <dd className="break-all font-mono text-xs">
                      {artifact.content_sha256 ?? "No source hash"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs">Version</dt>
                    <dd>{artifact.version}</dd>
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
          ))}
        </div>
      )}
    </section>
  );
}
