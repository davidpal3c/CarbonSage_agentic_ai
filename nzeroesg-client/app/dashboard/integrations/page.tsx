"use client";

import { useEffect, useState } from "react";
import { Cloud, Database, FileCheck2, LockKeyhole, Trash2 } from "lucide-react";

import { Spinner } from "@/app/components/Spinner";
import { useWorkspaceDataStore } from "@/app/dashboard/workspace-data-store";

export default function IntegrationsPage() {
  const demoData = useWorkspaceDataStore((state) => state.demoData);
  const demoError = useWorkspaceDataStore((state) => state.demoError);
  const ensureDemoData = useWorkspaceDataStore((state) => state.ensureDemoData);
  const loadWorkspaceDemoData = useWorkspaceDataStore(
    (state) => state.loadDemoData,
  );
  const unloadWorkspaceDemoData = useWorkspaceDataStore(
    (state) => state.unloadDemoData,
  );
  const [pendingAction, setPendingAction] = useState<"load" | "unload" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void ensureDemoData().catch(() => undefined);
  }, [ensureDemoData]);

  async function loadDemoData() {
    setPendingAction("load");
    setActionError(null);
    try {
      await loadWorkspaceDemoData();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Demo simulation data could not be loaded.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function unloadDemoData() {
    if (
      !window.confirm(
        "Unload the fictional simulation dataset? User-uploaded files and records will remain in this workspace.",
      )
    ) {
      return;
    }
    setPendingAction("unload");
    setActionError(null);
    try {
      await unloadWorkspaceDemoData();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Demo simulation data could not be removed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const hasWorkspaceData = Boolean(
    demoData &&
      (demoData.has_artifacts ||
        demoData.shipment_count ||
        demoData.supplier_count),
  );
  const error = actionError ?? demoError;

  return (
    <section className="px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Integrations
        </h1>
        <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">
          Bring supplier disclosures, spreadsheets, and shipment records into
          one carbon-intelligence workspace. CarbonSage normalizes the useful
          facts while preserving source identity for citations.
        </p>
      </header>

      {error ? (
        <p className="mt-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-7 space-y-4">
        <article className="w-full rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <Database aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  Demo simulation data
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Load a fictional workspace with 24 supplier profiles, cited
                  disclosures, and a mixed-mode shipment baseline. Unloading it
                  removes only seeded simulation records—not your uploads.
                </p>
                {demoData?.loaded ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-secondary">
                    <FileCheck2 aria-hidden="true" className="h-4 w-4" />
                    {demoData.supplier_count} suppliers ·{" "}
                    {demoData.shipment_count} shipments ·{" "}
                    {demoData.evidence_document_count} cited documents
                  </p>
                ) : null}
              </div>
            </div>
            {demoData?.loaded ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-md bg-secondary/10 px-2.5 py-1.5 text-xs font-semibold text-secondary">
                  Loaded
                </span>
                <button
                  type="button"
                  onClick={() => void unloadDemoData()}
                  disabled={pendingAction !== null}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-primary transition hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                >
                  {pendingAction === "unload" ? (
                    <Spinner />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  )}
                  Unload demo data
                </button>
              </div>
            ) : hasWorkspaceData ? (
              <span className="shrink-0 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                Workspace data present
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void loadDemoData()}
                disabled={pendingAction !== null}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-secondary/85 disabled:opacity-60"
              >
                {pendingAction === "load" ? <Spinner /> : null}
                Load demo data
              </button>
            )}
          </div>
        </article>

        <article className="w-full rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
              <Cloud aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-primary">
                  Google Drive
                </h2>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">
                Select supplier reports, audit evidence, spreadsheets, and
                shipment files from Drive. Imported files will retain their
                source identity so CarbonSage can cite the document behind a
                normalized fact or recommendation.
              </p>
              <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole
                  aria-hidden="true"
                  className="h-4 w-4 text-accent"
                />
                A connection will require explicit account authorization and
                selected-file access.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
