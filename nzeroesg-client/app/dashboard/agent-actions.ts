import { getBackendUrl } from "@/app/api/urls";

export async function runWorkspaceAgentAction(
  actionId: string,
  artifactId: string | null,
) {
  void artifactId;
  if (actionId === "workspace.load_demo_data") {
    const response = await fetch(`${getBackendUrl()}/demo/data`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(payload?.detail ?? "Demo data could not be loaded.");
    }
    const detail = await response.json();
    window.dispatchEvent(new CustomEvent("carbonsage:data-loaded", { detail }));
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
