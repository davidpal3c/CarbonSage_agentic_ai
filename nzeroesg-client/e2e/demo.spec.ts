import { expect, type Page, test } from "@playwright/test";

const shipmentCsv = [
  "shipment_id,origin,destination,weight_value,weight_unit,distance_value,distance_unit,transport_method",
  "S-001,Edmonton,Calgary,1,mt,100,km,truck",
  "S-002,Vancouver,Seattle,500,kg,200,km,train",
].join("\n");

const supplierEvidence =
  "Supplier ABC holds ISO 14001 certification and operates rail routes in Canada.";

// Render, Neon, and the configured embedding provider can need a few seconds
// to wake up in the production smoke test. Keep action-result assertions
// bounded without treating a normal remote round trip as a UI failure.
const backendActionTimeout = 30_000;

async function enterWorkspace(page: Page) {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Enter a private workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Private workspace")).toBeVisible();
}

test("completes the five-minute demo workflow and exports a report", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await enterWorkspace(page);

  await page.getByLabel("Shipment CSV").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await page.getByRole("button", { name: "Upload and analyze" }).click();
  await expect(page.getByText("Accepted shipments")).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(page.getByText("Total emissions")).toBeVisible();
  await expect(
    page.getByRole("table").last().getByRole("cell", { name: "S-001" }),
  ).toBeVisible();
  await expect(page.getByText("Emissions by mode")).toBeVisible();
  await expect(page.getByText("Top shipment hotspots")).toBeVisible();
  await expect(page.getByText("Shipment dataset", { exact: true })).toBeVisible(
    { timeout: backendActionTimeout },
  );

  await page.getByRole("button", { name: "Rename shipments.csv" }).click();
  await page.getByLabel("Artifact title").fill("Q3 freight baseline");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("heading", { name: "Q3 freight baseline" }),
  ).toBeVisible();

  await page.getByLabel("Supplier name").fill("Supplier ABC");
  await page
    .getByLabel("Evidence document (TXT or text-based PDF)")
    .setInputFiles({
      name: "supplier.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(supplierEvidence),
    });
  await page.getByRole("button", { name: "Upload evidence" }).click();
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
  const retrievalStatus = page.getByText(
    /Used (hybrid|lexical) retrieval · semantic provider (available|unavailable)/,
  );
  await expect(retrievalStatus).toBeVisible({ timeout: backendActionTimeout });
  const retrievalStatusText = await retrievalStatus.textContent();
  if (retrievalStatusText?.includes("provider unavailable")) {
    expect(retrievalStatusText).toContain(
      "hybrid search used the lexical baseline",
    );
  } else {
    expect(retrievalStatusText).toContain(
      "Used hybrid retrieval · semantic provider available",
    );
  }

  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Current baseline")).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(page.getByText("Scenario comparison")).toBeVisible();
  await expect(page.getByText("Report preview · methodology")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Scenario result by shipment" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save report snapshot" }).click();
  await expect(
    page.locator("#scenarios").getByText(/Saved Decision report/),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(
    page.getByText("Report snapshot", { exact: true }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("carbonsage-report.csv");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#scenarios")).toBeVisible();
  await expect(page.locator("aside")).toBeHidden();

  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Leave workspace" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("keeps two demo workspaces isolated", async ({ page, browser }) => {
  await enterWorkspace(page);
  const firstWorkspace = await page.locator("code").first().textContent();

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await enterWorkspace(secondPage);
  const secondWorkspace = await secondPage
    .locator("code")
    .first()
    .textContent();

  expect(firstWorkspace).toBeTruthy();
  expect(secondWorkspace).toBeTruthy();
  expect(secondWorkspace).not.toBe(firstWorkspace);
  await expect(
    secondPage.getByText(
      "No supplier evidence has been uploaded in this workspace.",
    ),
  ).toBeVisible();
  await expect(
    secondPage.getByText(
      "No active artifacts yet. Upload shipment data or supplier evidence to create the first workspace artifact.",
    ),
  ).toBeVisible();
  await secondContext.close();
});

test("soft-deletes a shipment artifact and removes its active analysis", async ({
  page,
}) => {
  await enterWorkspace(page);
  await page.getByLabel("Shipment CSV").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await page.getByRole("button", { name: "Upload and analyze" }).click();
  await expect(page.getByText("Accepted shipments")).toBeVisible({
    timeout: backendActionTimeout,
  });
  const deleteButton = page.getByRole("button", {
    name: "Delete shipments.csv",
  });
  await expect(deleteButton).toBeVisible({ timeout: backendActionTimeout });
  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();

  await expect(
    page.getByText(
      "No active artifacts yet. Upload shipment data or supplier evidence to create the first workspace artifact.",
    ),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(
    page.getByRole("button", { name: "Run scenario" }),
  ).toBeDisabled();
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

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Private workspace")).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.documentWidth).toBeLessThanOrEqual(viewport.width);

  const shipmentInput = page.getByLabel("Shipment CSV");
  await shipmentInput.focus();
  await expect(shipmentInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Upload and analyze" }),
  ).toBeFocused();
});
