import { getBackendUrl } from "@/app/api/urls";
import { useWorkspaceDataStore } from "@/app/dashboard/workspace-data-store";

export async function runWorkspaceAgentAction(
  actionId: string,
  artifactId: string | null,
) {
  void artifactId;
  if (actionId === "workspace.load_demo_data") {
    await useWorkspaceDataStore.getState().loadDemoData();
    return;
  }

  if (actionId !== "reports.save_snapshot") {
    throw new Error(`Unsupported agent action: ${actionId}`);
  }

  const response = await fetch(`${getBackendUrl()}/reports/snapshots`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alternative_mode: null }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(payload?.detail ?? "Report snapshot could not be saved.");
  }
}
