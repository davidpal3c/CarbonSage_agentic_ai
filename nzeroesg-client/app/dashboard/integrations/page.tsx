"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, Database, FileCheck2, LockKeyhole } from "lucide-react";

import { getBackendUrl } from "@/app/api/urls";
import { Spinner } from "@/app/components/Spinner";
import { runWorkspaceAgentAction } from "@/app/dashboard/agent-actions";

type DemoDataStatus = {
  has_artifacts: boolean;
  shipment_count: number;
  supplier_count: number;
  evidence_document_count: number;
};

export default function IntegrationsPage() {
  const [demoData, setDemoData] = useState<DemoDataStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemoData, setIsLoadingDemoData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDemoData = useCallback(async () => {
    const response = await fetch(`${getBackendUrl()}/demo/data`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Workspace data status is unavailable.");
    setDemoData((await response.json()) as DemoDataStatus);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    fetch(`${getBackendUrl()}/demo/data`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Workspace data status is unavailable.");
        }
        return (await response.json()) as DemoDataStatus;
      })
      .then((payload) => {
        if (isCurrent) setDemoData(payload);
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Workspace data status is unavailable.",
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

  async function loadDemoData() {
    setIsLoadingDemoData(true);
    setError(null);
    try {
      await runWorkspaceAgentAction("workspace.load_demo_data", null);
      await refreshDemoData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Demo simulation data could not be loaded.",
      );
    } finally {
      setIsLoadingDemoData(false);
    }
  }

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
                  disclosures, and a mixed-mode shipment baseline. It can be
                  removed at any time from Artifacts.
                </p>
                {demoData?.has_artifacts ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-secondary">
                    <FileCheck2 aria-hidden="true" className="h-4 w-4" />
                    {demoData.supplier_count} suppliers ·{" "}
                    {demoData.shipment_count} shipments ·{" "}
                    {demoData.evidence_document_count} cited documents
                  </p>
                ) : null}
              </div>
            </div>
            {isLoading ? (
              <Spinner label="Checking demo data" className="h-5 w-5" />
            ) : demoData?.has_artifacts ? (
              <span className="shrink-0 rounded-md bg-secondary/10 px-2.5 py-1.5 text-xs font-semibold text-secondary">
                Loaded
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void loadDemoData()}
                disabled={isLoadingDemoData}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-accent disabled:opacity-60"
              >
                {isLoadingDemoData ? <Spinner /> : null}
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
