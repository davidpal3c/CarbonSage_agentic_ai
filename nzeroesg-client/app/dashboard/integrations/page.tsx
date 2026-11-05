"use client";

import { useEffect, useState } from "react";
import { Cloud, Database, FileCheck2, LockKeyhole, Trash2 } from "lucide-react";

import { Spinner } from "@/app/components/Spinner";
import { useWorkspaceDataStore } from "@/app/dashboard/workspace-data-store";
import {
  buttonPrimary,
  buttonSecondary,
  Card,
  chipClass,
  IconTile,
  PageHeader,
  WorkspacePage,
} from "@/app/dashboard/workspace-ui";

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
    <WorkspacePage>
      <PageHeader
        title="Integrations"
        description="Bring supplier disclosures, spreadsheets, and shipment records into one carbon-intelligence workspace. CarbonSage normalizes the useful facts while preserving source identity for citations."
      />

      {error ? (
        <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-3.5">
        <Card as="article">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <IconTile>
                <Database aria-hidden="true" className="h-4 w-4" />
              </IconTile>
              <div>
                <h2 className="text-[17px] font-semibold text-primary">
                  Demo simulation data
                </h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Load a fictional workspace with 30 supplier profiles, cited
                  disclosures, and a global mixed-mode shipment baseline.
                  Unloading it removes only seeded simulation records—not your
                  uploads.
                </p>
                {demoData?.loaded ? (
                  <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-tertiary">
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
                <span className={chipClass}>Loaded</span>
                <button
                  type="button"
                  onClick={() => void unloadDemoData()}
                  disabled={pendingAction !== null}
                  className={`${buttonSecondary} hover:border-red-300 hover:text-red-700`}
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
              <span className={`${chipClass} shrink-0`}>
                Workspace data present
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void loadDemoData()}
                disabled={pendingAction !== null}
                className={`${buttonPrimary} shrink-0`}
              >
                {pendingAction === "load" ? <Spinner /> : null}
                Load demo data
              </button>
            )}
          </div>
        </Card>

        <Card as="article">
          <div className="flex items-start gap-3">
            <IconTile>
              <Cloud aria-hidden="true" className="h-4 w-4" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[17px] font-semibold text-primary">
                  Google Drive
                </h2>
                <span className={chipClass}>Coming soon</span>
              </div>
              <p className="mt-1.5 max-w-4xl text-sm leading-6 text-muted-foreground">
                Select supplier reports, audit evidence, spreadsheets, and
                shipment files from Drive. Imported files will retain their
                source identity so CarbonSage can cite the document behind a
                normalized fact or recommendation.
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole
                  aria-hidden="true"
                  className="h-4 w-4 text-accent"
                />
                A connection will require explicit account authorization and
                selected-file access.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </WorkspacePage>
  );
}
