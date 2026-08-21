import { expect, type Page, type Route, test } from "@playwright/test";

const shipmentCsv = [
  "shipment_id,shipment_date,origin,destination,weight_value,weight_unit,distance_value,distance_unit,transport_method",
  "S-001,2026-01-12,Edmonton,Calgary,1,mt,100,km,truck",
  "S-002,2026-02-18,Vancouver,Seattle,500,kg,200,km,train",
].join("\n");

const supplierEvidence =
  "Supplier ABC holds ISO 14001 certification and operates rail routes in Canada.";
const emptySupplierCsv =
  "supplier_id,name,region,certifications,transport_modes,documents\n";

// Render, Neon, and the configured embedding provider can need a few seconds
// to wake up in the production smoke test. Keep action-result assertions
// bounded without treating a normal remote round trip as a UI failure.
const backendActionTimeout = 30_000;

async function enterWorkspace(page: Page) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Enter the demo workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard\/overview$/, {
    timeout: backendActionTimeout,
  });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(/^Ready$/)).toHaveCount(0);
  await expect(page.getByText(/Phase\s+\d+/)).toHaveCount(0);
  await expect(
    page.getByText(/policy v|typed tools|control plane/i),
  ).toHaveCount(0);
  await expect(page.locator("code")).toHaveCount(0);
}

async function openWorkspacePage(page: Page, label: string, path: string) {
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: label, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/${path}$`), {
    timeout: backendActionTimeout,
  });
  await expect(
    page.getByRole("link", { name: label, exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

async function openShipmentImport(page: Page) {
  await page.getByRole("button", { name: "Import shipments" }).click();
  const dialog = page.getByRole("dialog", { name: "Import shipments" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("completes the five-minute demo workflow and exports a report", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page);
  await openWorkspacePage(page, "Shipments", "shipments");

  const shipmentDialog = await openShipmentImport(page);
  await shipmentDialog.getByLabel("Shipment file").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await shipmentDialog
    .getByRole("button", { name: "Upload and analyze" })
    .click();
  await expect(page.getByText("Shipments", { exact: true }).last()).toBeVisible(
    {
      timeout: backendActionTimeout,
    },
  );
  await expect(page.getByText("Total emissions")).toBeVisible();
  await expect(
    page.getByRole("table").last().getByRole("cell", { name: "S-001" }),
  ).toBeVisible();
  await expect(page.getByText("Emissions by mode over time")).toBeVisible();
  await expect(page.getByText("Top shipment hotspots")).toBeVisible();
  await openWorkspacePage(page, "Artifacts", "artifacts");
  await expect(page.getByText("Shipment dataset", { exact: true })).toBeVisible(
    { timeout: backendActionTimeout },
  );

  await page.getByRole("button", { name: "Actions for shipments.csv" }).click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Artifact title").fill("Q3 freight baseline");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Q3 freight baseline" }),
  ).toBeVisible();

  await openWorkspacePage(page, "Suppliers", "evidence");
  await page.getByRole("button", { name: "Add supplier" }).click();
  await page.getByLabel("Supplier name").fill("Supplier ABC");
  await page
    .getByLabel("Evidence document (optional PDF or TXT)")
    .setInputFiles({
      name: "supplier.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(supplierEvidence),
    });
  await page.getByRole("button", { name: "Add supplier" }).last().click();
  await expect(page.getByText("Supplier ABC", { exact: true })).toBeVisible({
    timeout: backendActionTimeout,
  });

  await page.getByLabel("Search document evidence").fill("ISO 14001");
  await page.getByRole("button", { name: "Search citations" }).click();
  await expect(page.getByText(/Supplier ABC holds ISO 14001/)).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(page.getByText(/Citation: supplier.txt/)).toBeVisible();

  await page.getByLabel("Retrieval mode").selectOption("hybrid");
  await page.getByRole("button", { name: "Search citations" }).click();
  const retrievalStatus = page.getByText(/(Hybrid|Keyword) search/);
  await expect(retrievalStatus).toBeVisible({ timeout: backendActionTimeout });
  const retrievalStatusText = await retrievalStatus.textContent();
  if (retrievalStatusText?.includes("Keyword search")) {
    expect(retrievalStatusText).toContain(
      "hybrid search used the lexical baseline",
    );
  } else {
    expect(retrievalStatusText).toContain("Hybrid search");
  }

  await openWorkspacePage(page, "Scenarios", "scenarios");
  await expect(
    page.getByRole("heading", { name: "Guided scenario modelling" }),
  ).toBeVisible();
  await expect(page.getByText("Coming soon", { exact: true })).toBeVisible();

  let reportPreviewRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/reports/preview") {
      reportPreviewRequests += 1;
    }
  });
  await openWorkspacePage(page, "Report", "report");
  await expect(page.getByText("Current baseline")).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(page.getByText("Methodology", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save report snapshot" }).click();
  await expect(page.getByText(/Saved Decision report/)).toBeVisible({
    timeout: backendActionTimeout,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("carbonsage-report.csv");

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { name: "Report" })).toBeVisible();
  await expect(page.locator("aside")).toBeHidden();

  await page.emulateMedia({ media: "screen" });
  await openWorkspacePage(page, "Artifacts", "artifacts");
  await expect(
    page.getByText("Report snapshot", { exact: true }),
  ).toBeVisible();
  await openWorkspacePage(page, "Report", "report");
  await expect(page.getByText("Current baseline")).toBeVisible();
  expect(reportPreviewRequests).toBe(1);
  const workspaceMenu = page.getByRole("button", {
    name: "Open workspace menu",
  });
  await workspaceMenu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "How to use CarbonSage" }),
  ).toBeVisible();
  const menuBox = await page
    .getByRole("menu", { name: "Workspace menu" })
    .boundingBox();
  const avatarBox = await workspaceMenu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(avatarBox).not.toBeNull();
  expect(
    (menuBox?.x ?? 0) - ((avatarBox?.x ?? 0) + (avatarBox?.width ?? 0)),
  ).toBeLessThanOrEqual(24);
  const menuViewport = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(menuViewport.documentWidth).toBeLessThanOrEqual(menuViewport.width);
  const signOut = page.getByRole("button", { name: "Sign out" });
  await signOut.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/, { timeout: backendActionTimeout });
});

test("loads the fictional demo dataset directly from overview", async ({
  page,
}) => {
  test.setTimeout(120_000);
  let shipmentRequests = 0;
  let analyticsRequests = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/shipments") shipmentRequests += 1;
    if (pathname === "/shipments/analytics") analyticsRequests += 1;
  });
  await enterWorkspace(page);
  await openWorkspacePage(page, "Overview", "overview");
  await expect(
    page.getByRole("button", { name: "Load demo data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Carbon metrics" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Monthly freight footprint" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Aggregate emissions mix" }),
  ).toBeVisible();
  await expect(page.getByText("No emissions trend yet")).toBeVisible();
  await expect(page.getByText("No shipment hotspots yet")).toBeVisible();
  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(
    page.getByRole("img", {
      name: "Freight emissions trend by transport mode",
    }),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(
    page.getByRole("button", { name: "Load demo data" }),
  ).toBeHidden();
  await expect(
    page.locator(".recharts-cartesian-axis-tick-value").first(),
  ).toHaveCSS("font-size", "10px");

  await openWorkspacePage(page, "Artifacts", "artifacts");
  await expect(
    page.getByRole("heading", { name: "carbonsage-demo-shipments.csv" }),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(
    page.getByRole("heading", { name: "boreal-components-profile.txt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "northstar-logistics-disclosure.txt",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "aurora-packaging-disclosure.txt",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Actions for / })).toHaveCount(
    6,
  );
  await page
    .getByRole("button", { name: "Actions for carbonsage-demo-shipments.csv" })
    .click();
  await expect(
    page.getByRole("button", { name: "Download source" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  const artifactPreview = page.getByRole("dialog", {
    name: "carbonsage-demo-shipments.csv",
  });
  await expect(artifactPreview).toBeVisible();
  await expect(
    artifactPreview.getByText(/shipment_id,shipment_date/),
  ).toBeVisible();
  await artifactPreview
    .getByRole("button", { name: "Close artifact preview" })
    .click();
  await expect(artifactPreview).toBeHidden();

  await openWorkspacePage(page, "Shipments", "shipments");
  await expect(page.getByText("48", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Stacked month freight emissions/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Top shipment emissions hotspots" }),
  ).toBeVisible();
  await page.getByLabel("Group by").selectOption("year");
  await expect(
    page.getByText("Stacked year totals; hover or focus the chart"),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect.poll(() => analyticsRequests).toBe(1);

  await openWorkspacePage(page, "Overview", "overview");
  await expect(
    page.getByText("Total emissions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Freight emissions trend by transport mode",
    }),
  ).toBeVisible();
  const shipmentRequestsBeforeNavigation = shipmentRequests;
  await openWorkspacePage(page, "Shipments", "shipments");
  expect(shipmentRequests).toBe(shipmentRequestsBeforeNavigation);
  await openWorkspacePage(page, "Suppliers", "evidence");
  await expect(
    page.getByText("Boreal Components", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Northstar Logistics", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Coastal Biofuels", { exact: true }),
  ).toBeVisible();

  await openWorkspacePage(page, "Integrations", "integrations");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unload demo data" }).click();
  await expect(
    page.getByRole("button", { name: "Load demo data" }),
  ).toBeVisible({ timeout: backendActionTimeout });
  await openWorkspacePage(page, "Report", "report");
  await expect(
    page.getByText(
      "Upload at least one valid shipment before running a scenario.",
    ),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(
    page.getByRole("button", { name: "Load demo data" }),
  ).toBeVisible();
  await openWorkspacePage(page, "Artifacts", "artifacts");
  await expect(
    page.getByText(
      "No active artifacts yet. Load demo data or upload shipment and supplier sources to begin.",
    ),
  ).toBeVisible({ timeout: backendActionTimeout });
});

test("keeps two demo workspaces isolated", async ({ page, browser }) => {
  await enterWorkspace(page);
  await openWorkspacePage(page, "Shipments", "shipments");
  const shipmentDialog = await openShipmentImport(page);
  await shipmentDialog.getByLabel("Shipment file").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await shipmentDialog
    .getByRole("button", { name: "Upload and analyze" })
    .click();
  await expect(page.getByText("Shipments", { exact: true }).last()).toBeVisible(
    {
      timeout: backendActionTimeout,
    },
  );

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await enterWorkspace(secondPage);
  await openWorkspacePage(secondPage, "Artifacts", "artifacts");
  await expect(
    secondPage.getByText(
      "No active artifacts yet. Load demo data or upload shipment and supplier sources to begin.",
    ),
  ).toBeVisible();
  await expect(
    secondPage.getByRole("button", { name: "Download shipments" }),
  ).toHaveCount(0);
  await expect(
    secondPage.getByRole("button", { name: "Download suppliers" }),
  ).toHaveCount(0);
  await openWorkspacePage(secondPage, "Suppliers", "evidence");
  await expect(
    secondPage.getByText("No suppliers have been added to this workspace."),
  ).toBeVisible();
  await secondContext.close();
});

test("soft-deletes a shipment artifact and removes its active analysis", async ({
  page,
}) => {
  await enterWorkspace(page);
  await openWorkspacePage(page, "Shipments", "shipments");
  const shipmentDialog = await openShipmentImport(page);
  await shipmentDialog.getByLabel("Shipment file").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await shipmentDialog
    .getByRole("button", { name: "Upload and analyze" })
    .click();
  await expect(page.getByText("Shipments", { exact: true }).last()).toBeVisible(
    {
      timeout: backendActionTimeout,
    },
  );
  await openWorkspacePage(page, "Artifacts", "artifacts");
  await page.getByRole("button", { name: "Actions for shipments.csv" }).click();
  const deleteButton = page.getByRole("button", { name: "Delete" });
  await expect(deleteButton).toBeVisible({ timeout: backendActionTimeout });
  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();

  await expect(
    page.getByText(
      "No active artifacts yet. Load demo data or upload shipment and supplier sources to begin.",
    ),
  ).toBeVisible({ timeout: backendActionTimeout });
  await openWorkspacePage(page, "Scenarios", "scenarios");
  await expect(
    page.getByRole("heading", { name: "Guided scenario modelling" }),
  ).toBeVisible();
});

test("explains when a supplier CSV is selected as shipment data", async ({
  page,
}) => {
  await enterWorkspace(page);
  await openWorkspacePage(page, "Shipments", "shipments");
  const shipmentDialog = await openShipmentImport(page);
  await shipmentDialog.getByLabel("Shipment file").setInputFiles({
    name: "carbonsage-suppliers.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(emptySupplierCsv),
  });
  await shipmentDialog
    .getByRole("button", { name: "Upload and analyze" })
    .click();

  await expect(page.getByText("We couldn’t import this file")).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(page.getByText(/This looks like supplier data/)).toBeVisible();
  await expect(page.getByText("Emissions by mode over time")).toHaveCount(0);
});

test("keeps the deterministic workspace usable when the agent is disabled", async ({
  page,
}) => {
  await enterWorkspace(page);
  await openWorkspacePage(page, "Ask CarbonSage", "agent");
  await expect(page.getByRole("region", { name: "CarbonSage" })).toBeVisible();
  await expect(page.getByText("Not configured", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message CarbonSage")).toBeDisabled();

  await openWorkspacePage(page, "Shipments", "shipments");
  const shipmentDialog = await openShipmentImport(page);
  await expect(shipmentDialog.getByLabel("Shipment file")).toBeEnabled();
  await expect(
    shipmentDialog.getByRole("button", { name: "Upload and analyze" }),
  ).toBeDisabled();
});

test("restores chat suggestions after loading demo data from an empty-workspace response", async ({
  page,
}) => {
  const now = new Date().toISOString();
  let conversationDetailRequests = 0;
  const conversation = {
    conversation_id: "00000000-0000-4000-8000-000000000031",
    workspace_id: "demo-empty-action",
    title: "Decision 1",
    status: "active",
    policy_version: "1.0",
    created_by: "demo-session",
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };

  await page.route("**/agent/health", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        available: true,
        policy_version: "1.0",
        response_schema_version: "1.0",
      },
    }),
  );
  // Usage metering is supplementary. A failed meter refresh must not mark a
  // healthy assistant unavailable or leave the composer disabled.
  await page.route("**/agent/usage", (route) => route.abort("failed"));
  await page.route("**/agent/conversations", (route) =>
    route.fulfill({ json: { conversations: [conversation] } }),
  );
  await page.route("**/agent/conversations/*", async (route) => {
    conversationDetailRequests += 1;
    if (conversationDetailRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    await route.fulfill({
      json: {
        conversation,
        messages: [
          {
            message_id: "00000000-0000-4000-8000-000000000032",
            conversation_id: conversation.conversation_id,
            workspace_id: conversation.workspace_id,
            role: "user",
            content: "What can I review in this workspace?",
            response: null,
            created_at: now,
          },
          {
            message_id: "00000000-0000-4000-8000-000000000033",
            conversation_id: conversation.conversation_id,
            workspace_id: conversation.workspace_id,
            role: "assistant",
            content: "This workspace does not have data yet.",
            created_at: now,
            response: {
              schema_version: "1.0",
              response_id: "00000000-0000-4000-8000-000000000034",
              policy_version: "1.0",
              evidence_status: "not_required",
              processing_time_ms: 2,
              generated_at: now,
              blocks: [
                {
                  type: "text",
                  text: "No supplier or shipment data is available yet.",
                },
                {
                  type: "action",
                  action_id: "workspace.load_demo_data",
                  label: "Load demo data",
                  requires_confirmation: false,
                  artifact_id: null,
                },
              ],
            },
          },
        ],
        tool_events: [],
      },
    });
  });
  await page.route("**/agent/conversations/*/messages", (route) =>
    route.fulfill({
      json: {
        user_message: {
          message_id: "00000000-0000-4000-8000-000000000035",
          conversation_id: conversation.conversation_id,
          workspace_id: conversation.workspace_id,
          role: "user",
          content: "Compare the current freight baseline with rail.",
          response: null,
          created_at: now,
        },
        assistant_message: {
          message_id: "00000000-0000-4000-8000-000000000036",
          conversation_id: conversation.conversation_id,
          workspace_id: conversation.workspace_id,
          role: "assistant",
          content: "The baseline comparison is ready.",
          created_at: now,
          response: {
            schema_version: "1.0",
            response_id: "00000000-0000-4000-8000-000000000037",
            policy_version: "1.0",
            evidence_status: "not_required",
            processing_time_ms: 8,
            generated_at: now,
            blocks: [
              {
                type: "text",
                text: "The baseline comparison is ready.",
              },
            ],
          },
        },
      },
    }),
  );

  await enterWorkspace(page);
  await openWorkspacePage(page, "Ask CarbonSage", "agent");
  const agent = page.getByRole("region", { name: "CarbonSage" });
  await agent.getByRole("button", { name: "Load demo data" }).click();

  await expect(agent.getByText(/Demo data is ready: 30 suppliers/)).toBeVisible(
    { timeout: backendActionTimeout },
  );
  await expect(
    agent.getByRole("button", { name: "Find the largest footprint" }),
  ).toBeEnabled();
  await expect(
    agent.getByRole("button", { name: "Compare with rail" }),
  ).toBeEnabled();
  await expect(agent.getByLabel("Message CarbonSage")).toBeEnabled();

  await agent.getByRole("button", { name: "Compare with rail" }).click();
  await expect(
    agent.getByText("The baseline comparison is ready."),
  ).toBeVisible();
  await expect(agent.getByLabel("Message CarbonSage")).toBeEnabled({
    timeout: 2_000,
  });
});

test("restores the latest workspace conversation before enabling input", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const conversation = {
    conversation_id: "00000000-0000-4000-8000-000000000011",
    workspace_id: "demo-history",
    title: "Prior workspace decision",
    status: "active",
    policy_version: "1.0",
    created_by: "demo-session",
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
  let createRequested = false;
  let conversationListRequests = 0;
  let conversationDetailRequests = 0;

  await page.route("**/agent/health", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        available: true,
        policy_version: "1.0",
        response_schema_version: "1.0",
      },
    }),
  );
  await page.route("**/agent/conversations", (route) => {
    if (route.request().method() !== "GET") {
      createRequested = true;
      return route.fulfill({
        status: 500,
        json: { detail: "Unexpected create" },
      });
    }
    conversationListRequests += 1;
    return route.fulfill({ json: { conversations: [conversation] } });
  });
  await page.route("**/agent/conversations/*", (route) => {
    conversationDetailRequests += 1;
    return route.fulfill({
      json: {
        conversation,
        messages: [
          {
            message_id: "00000000-0000-4000-8000-000000000012",
            conversation_id: conversation.conversation_id,
            workspace_id: conversation.workspace_id,
            role: "user",
            content: "What did we validate?",
            response: null,
            created_at: now,
          },
          {
            message_id: "00000000-0000-4000-8000-000000000013",
            conversation_id: conversation.conversation_id,
            workspace_id: conversation.workspace_id,
            role: "assistant",
            content: "The prior validated response.",
            created_at: now,
            response: {
              schema_version: "1.0",
              response_id: "00000000-0000-4000-8000-000000000014",
              policy_version: "1.0",
              evidence_status: "not_required",
              processing_time_ms: 4,
              generated_at: now,
              blocks: [
                { type: "text", text: "The previous decision is restored." },
              ],
            },
          },
        ],
        tool_events: [],
      },
    });
  });

  await enterWorkspace(page);
  await openWorkspacePage(page, "Ask CarbonSage", "agent");
  const dialog = page.getByRole("region", {
    name: "CarbonSage",
  });
  await expect(dialog.getByText("What did we validate?")).toBeVisible();
  await expect(
    dialog.getByText("The previous decision is restored."),
  ).toBeVisible();
  await expect(dialog.getByLabel("Message CarbonSage")).toBeEnabled();
  expect(createRequested).toBe(false);

  await openWorkspacePage(page, "Shipments", "shipments");
  await openWorkspacePage(page, "Ask CarbonSage", "agent");
  await expect(
    page
      .getByRole("region", { name: "CarbonSage" })
      .getByText("The previous decision is restored."),
  ).toBeVisible();
  expect(conversationListRequests).toBe(1);
  expect(conversationDetailRequests).toBe(1);
});

test("creates, switches, and closes workspace conversations", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const firstConversation = {
    conversation_id: "00000000-0000-4000-8000-000000000021",
    workspace_id: "demo-conversations",
    title: "Decision 1",
    status: "active",
    policy_version: "1.0",
    created_by: "demo-session",
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };
  const secondConversation = {
    ...firstConversation,
    conversation_id: "00000000-0000-4000-8000-000000000022",
    title: "Decision 2",
  };
  let closeRequested = false;

  await page.route("**/agent/health", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        available: true,
        policy_version: "1.0",
        response_schema_version: "1.0",
      },
    }),
  );
  await page.route("**/agent/conversations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        json: { conversations: [firstConversation] },
      });
    }
    return route.fulfill({ status: 201, json: secondConversation });
  });
  await page.route("**/agent/conversations/*", (route) => {
    if (route.request().method() === "DELETE") {
      closeRequested = true;
      return route.fulfill({ status: 204 });
    }
    const conversation = route.request().url().includes("000000000022")
      ? secondConversation
      : firstConversation;
    return route.fulfill({
      json: { conversation, messages: [], tool_events: [] },
    });
  });

  await enterWorkspace(page);
  await openWorkspacePage(page, "Ask CarbonSage", "agent");
  const agent = page.getByRole("region", { name: "CarbonSage" });
  const conversationSelect = agent.getByLabel("Conversation", { exact: true });
  await expect(conversationSelect).toHaveValue(
    firstConversation.conversation_id,
  );

  await agent.getByRole("button", { name: "New" }).click();
  await expect(conversationSelect).toHaveValue(
    secondConversation.conversation_id,
  );

  page.once("dialog", (dialog) => dialog.accept());
  await agent.getByRole("button", { name: "Close" }).click();
  await expect(conversationSelect).toHaveValue(
    firstConversation.conversation_id,
  );
  expect(closeRequested).toBe(true);
});

test("renders a typed interactive response with keyboard-accessible chart data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const corsHeaders = (route: Route) => ({
    "access-control-allow-origin":
      route.request().headers()["origin"] ?? "http://127.0.0.1:3000",
    "access-control-allow-credentials": "true",
    "content-type": "application/json",
  });
  const now = new Date().toISOString();
  const conversation = {
    conversation_id: "00000000-0000-4000-8000-000000000001",
    workspace_id: "demo-renderer",
    title: "Decision 1",
    status: "active",
    policy_version: "1.0",
    created_by: "demo-session",
    created_at: now,
    updated_at: now,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };

  await page.route("**/agent/health", (route) =>
    route.fulfill({
      headers: corsHeaders(route),
      json: {
        status: "ok",
        available: true,
        policy_version: "1.0",
        response_schema_version: "1.0",
      },
    }),
  );
  await page.route("**/agent/usage", (route) =>
    route.fulfill({
      headers: corsHeaders(route),
      json: {
        questions_used: 1,
        question_limit: 15,
        questions_remaining: 14,
        model_calls: 1,
        spend_usd: 0.0012,
        spend_is_estimate: true,
        currency: "USD",
        resets_at: new Date(Date.now() + 3_600_000).toISOString(),
      },
    }),
  );
  await page.route("**/artifacts/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/content")) {
      return route.fulfill({
        headers: {
          ...corsHeaders(route),
          "content-type": "text/plain; charset=utf-8",
        },
        body: "The supplier reports a validated transition target.",
      });
    }
    return route.fulfill({
      headers: corsHeaders(route),
      json: {
        artifact_id: "00000000-0000-4000-8000-000000000006",
        workspace_id: "demo-renderer",
        kind: "evidence_document",
        title: "supplier.txt",
        status: "ready",
        source_type: "generated",
        source_reference: null,
        media_type: "text/plain",
        content_sha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        version: 1,
        metadata: {},
        created_by: "demo-session",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
    });
  });
  await page.route("**/agent/conversations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        headers: corsHeaders(route),
        json: { conversations: [] },
      });
    }
    return route.fulfill({
      status: 201,
      headers: corsHeaders(route),
      json: conversation,
    });
  });
  await page.route("**/agent/conversations/*", (route) =>
    route.fulfill({
      headers: corsHeaders(route),
      json: {
        conversation,
        messages: [],
        tool_events: [
          {
            event_id: "00000000-0000-4000-8000-000000000009",
            tool_name: "calculate_freight_emissions",
            status: "succeeded",
            duration_ms: 11,
            result_count: 2,
            artifact_ids: [],
            error_code: null,
          },
        ],
      },
    }),
  );
  await page.route("**/agent/conversations/*/messages", (route) =>
    route.fulfill({
      headers: corsHeaders(route),
      json: {
        user_message: {
          message_id: "00000000-0000-4000-8000-000000000002",
          conversation_id: "00000000-0000-4000-8000-000000000001",
          workspace_id: "demo-renderer",
          role: "user",
          content: "Compare rail and air.",
          response: null,
          created_at: now,
        },
        assistant_message: {
          message_id: "00000000-0000-4000-8000-000000000003",
          conversation_id: "00000000-0000-4000-8000-000000000001",
          workspace_id: "demo-renderer",
          role: "assistant",
          content: "Validated scenario response.",
          created_at: now,
          response: {
            schema_version: "1.0",
            response_id: "00000000-0000-4000-8000-000000000004",
            policy_version: "1.0",
            evidence_status: "supported",
            processing_time_ms: 18,
            generated_at: now,
            blocks: [
              { type: "text", text: "Validated tool results follow." },
              {
                type: "metric",
                label: "Rail emissions",
                value: 2.2,
                unit: "kg CO2e",
                context: "1 tonne over 100 km",
              },
              {
                type: "table",
                title: "Mode comparison",
                columns: [
                  { key: "mode", label: "Mode", unit: null },
                  {
                    key: "emissions_kg",
                    label: "Emissions",
                    unit: "kg CO2e",
                  },
                ],
                rows: [
                  { mode: "Rail", emissions_kg: 2.2 },
                  { mode: "Air", emissions_kg: 60.2 },
                ],
                caption: "Exact mode comparison values.",
              },
              {
                type: "chart",
                chart_kind: "bar",
                title: "Rail and air emissions",
                x_key: "mode",
                series: [
                  {
                    key: "emissions_kg",
                    label: "Emissions",
                    unit: "kg CO2e",
                  },
                ],
                rows: [
                  { mode: "Rail", emissions_kg: 2.2 },
                  { mode: "Air", emissions_kg: 60.2 },
                ],
                table_fallback: {
                  type: "table",
                  title: "Rail and air emissions",
                  columns: [
                    { key: "mode", label: "Mode", unit: null },
                    {
                      key: "emissions_kg",
                      label: "Emissions",
                      unit: "kg CO2e",
                    },
                  ],
                  rows: [
                    { mode: "Rail", emissions_kg: 2.2 },
                    { mode: "Air", emissions_kg: 60.2 },
                  ],
                  caption: "Chart values in table form.",
                },
              },
              {
                type: "citation",
                citation_id: "00000000-0000-4000-8000-000000000005",
                artifact_id: "00000000-0000-4000-8000-000000000006",
                filename: "supplier.txt",
                document_sha256:
                  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                page_number: 1,
                chunk_index: 0,
                excerpt: "The supplier reports a validated transition target.",
              },
              {
                type: "artifact_reference",
                artifact_id: "00000000-0000-4000-8000-000000000006",
                title: "Supplier evidence",
                artifact_kind: "evidence_document",
              },
              {
                type: "warning",
                code: "retrieval_fallback",
                message: "Semantic retrieval fell back to lexical evidence.",
              },
              {
                type: "action",
                action_id: "reports.save_snapshot",
                label: "Save report snapshot",
                requires_confirmation: true,
                artifact_id: null,
              },
              {
                type: "suggestions",
                title: "Explore this result",
                options: [
                  {
                    label: "Compare with Train",
                    prompt: "Compare the current freight baseline with train.",
                  },
                  {
                    label: "Review supplier evidence",
                    prompt: "Review the supplier evidence behind this result.",
                  },
                  {
                    label: "View mode trend",
                    prompt: "Show the monthly trend for these transport modes.",
                  },
                ],
              },
              { type: "future_decision_block", value: "safe fallback" },
            ],
          },
        },
      },
    }),
  );

  await enterWorkspace(page);
  const openAgent = page.getByRole("link", {
    name: "Ask CarbonSage",
    exact: true,
  });
  await openAgent.focus();
  await expect(openAgent).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/agent$/);

  const agentDialog = page.getByRole("region", {
    name: "CarbonSage",
  });
  const input = agentDialog.getByLabel("Message CarbonSage");
  await expect(input).toBeEnabled();
  await input.fill("Compare rail and air.");
  await page.keyboard.press("Enter");

  await expect(
    agentDialog.getByText("Compare rail and air.", { exact: true }),
  ).toBeVisible();

  await expect(
    agentDialog.getByText("Rail emissions", { exact: true }),
  ).toBeVisible();
  await expect(
    agentDialog.getByText("2.2 kg CO2e", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    agentDialog.getByRole("img", { name: /Rail and air emissions/ }),
  ).toBeVisible();
  await agentDialog.locator(".recharts-bar-rectangle").first().hover();
  await expect(
    agentDialog.locator(".recharts-tooltip-wrapper").getByText(/kg CO2e/),
  ).toBeVisible();
  await expect(agentDialog.getByText("14 left · <1¢")).toBeVisible();
  const chartTableToggle = agentDialog.getByText("View chart data");
  await chartTableToggle.focus();
  await expect(chartTableToggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    agentDialog.getByRole("table", {
      name: "Chart values in table form.",
    }),
  ).toBeVisible();
  await expect(
    agentDialog.getByText(
      "The supplier reports a validated transition target.",
    ),
  ).toBeVisible();
  await agentDialog
    .getByRole("button", { name: "View source supplier.txt" })
    .click();
  const citationPreview = page.getByRole("dialog", { name: "supplier.txt" });
  await expect(citationPreview).toBeVisible();
  await expect(
    citationPreview.getByText(
      "The supplier reports a validated transition target.",
    ),
  ).toBeVisible();
  await citationPreview
    .getByRole("button", { name: "Close artifact preview" })
    .click();
  await expect(
    agentDialog.getByText("Supplier evidence", { exact: true }),
  ).toBeVisible();
  await expect(
    agentDialog.getByText("Semantic retrieval fell back to lexical evidence."),
  ).toBeVisible();
  const suggestions = agentDialog.getByRole("region", {
    name: "Explore this result",
  });
  await expect(suggestions).toBeVisible();
  await expect(suggestions).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  const suggestionButtons = suggestions.getByRole("button");
  await expect(suggestionButtons).toHaveCount(3);
  const firstSuggestionBorder = await suggestionButtons
    .nth(0)
    .evaluate((element) => getComputedStyle(element).borderColor);
  const secondSuggestionBorder = await suggestionButtons
    .nth(1)
    .evaluate((element) => getComputedStyle(element).borderColor);
  expect(firstSuggestionBorder).not.toBe(secondSuggestionBorder);
  const assistantResponse = agentDialog
    .locator("article[data-message-id]")
    .filter({ hasText: "Validated tool results follow." });
  await expect(assistantResponse.locator(":scope > div")).not.toHaveCSS(
    "box-shadow",
    "none",
  );
  await expect(
    agentDialog.getByText(
      "This response includes an item that cannot be displayed here yet.",
    ),
  ).toBeVisible();
  await agentDialog.getByText("Response details · 18 ms").click();
  await expect(
    agentDialog.getByText("14 questions remaining").first(),
  ).toBeVisible();
  await expect(agentDialog.getByText("<$0.01 USD").first()).toBeVisible();
  await expect(agentDialog.getByText("Sources verified").first()).toBeVisible();
  await expect(
    agentDialog.getByText("18 ms", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    agentDialog.getByText("Calculated freight emissions").first(),
  ).toBeVisible();
  await agentDialog.getByRole("button", { name: "Compare with Train" }).click();
  await expect(
    agentDialog.getByText("Compare the current freight baseline with train.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    agentDialog.getByRole("button", { name: /Supplier evidence/ }).first(),
  ).toBeVisible();

  const action = agentDialog
    .getByRole("button", {
      name: "Save report snapshot",
    })
    .first();
  page.once("dialog", (dialog) => dialog.dismiss());
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(action).toHaveText("Save report snapshot");

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.width);
});

test("supports keyboard entry and a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");

  const enterButton = page.getByRole("button", {
    name: "Enter demo workspace",
  });
  await enterButton.focus();
  await expect(enterButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/dashboard\/overview$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.width);

  await openWorkspacePage(page, "Shipments", "shipments");
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/shipments$/);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  const shipmentDialog = await openShipmentImport(page);
  const shipmentInput = shipmentDialog.getByLabel("Shipment file");
  await shipmentInput.focus();
  await expect(shipmentInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    shipmentDialog.getByRole("link", { name: "Download XLSX template" }),
  ).toBeFocused();
});
