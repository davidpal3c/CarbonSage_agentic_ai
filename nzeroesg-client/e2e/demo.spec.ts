import { expect, type Page, test } from "@playwright/test";

const shipmentCsv = [
  "shipment_id,origin,destination,weight_value,weight_unit,distance_value,distance_unit,transport_method",
  "S-001,Edmonton,Calgary,1,mt,100,km,truck",
  "S-002,Vancouver,Seattle,500,kg,200,km,train",
].join("\n");

const supplierEvidence =
  "Supplier ABC holds ISO 14001 certification and operates rail routes in Canada.";

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
  await enterWorkspace(page);

  await page.getByLabel("Shipment CSV").setInputFiles({
    name: "shipments.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(shipmentCsv),
  });
  await page.getByRole("button", { name: "Upload and analyze" }).click();
  await expect(page.getByText("Accepted shipments")).toBeVisible();
  await expect(page.getByText("Total emissions")).toBeVisible();
  await expect(
    page.getByRole("table").last().getByRole("cell", { name: "S-001" }),
  ).toBeVisible();
  await expect(page.getByText("Emissions by mode")).toBeVisible();
  await expect(page.getByText("Top shipment hotspots")).toBeVisible();

  await page.getByLabel("Supplier name").fill("Supplier ABC");
  await page
    .getByLabel("Evidence document (TXT or text-based PDF)")
    .setInputFiles({
      name: "supplier.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(supplierEvidence),
    });
  await page.getByRole("button", { name: "Upload evidence" }).click();
  await expect(page.getByText("Supplier ABC", { exact: true })).toBeVisible();

  await page.getByLabel("Search document evidence").fill("ISO 14001");
  await page.getByRole("button", { name: "Search citations" }).click();
  await expect(page.getByText(/Supplier ABC holds ISO 14001/)).toBeVisible();
  await expect(page.getByText(/Citation: supplier.txt/)).toBeVisible();

  await page.getByLabel("Retrieval mode").selectOption("hybrid");
  await page.getByRole("button", { name: "Search citations" }).click();
  await expect(
    page.getByText(/Used lexical retrieval · semantic provider unavailable/),
  ).toBeVisible();
  await expect(
    page.getByText(/hybrid search used the lexical baseline/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Run scenario" }).click();
  await expect(page.getByText("Current baseline")).toBeVisible();
  await expect(page.getByText("Scenario comparison")).toBeVisible();
  await expect(page.getByText("Report preview · methodology")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Scenario result by shipment" }),
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
  await secondContext.close();
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
