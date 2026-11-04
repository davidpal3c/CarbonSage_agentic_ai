import { expect, type Page, test } from "@playwright/test";

// Focused checks for the workspace shell and Overview layout risks:
// complete navigation on every breakpoint, drawer focus handling, a launcher
// that cannot cover content, honest Overview states, and theme persistence.

const backendActionTimeout = 30_000;

const destinations = [
  ["Overview", "overview"],
  ["Ask CarbonSage", "agent"],
  ["Integrations", "integrations"],
  ["Artifacts", "artifacts"],
  ["Report", "report"],
  ["Shipments", "shipments"],
  ["Suppliers", "evidence"],
  ["Scenarios", "scenarios"],
] as const;

async function enterWorkspace(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard\/overview$/, {
    timeout: backendActionTimeout,
  });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(size.documentWidth).toBeLessThanOrEqual(size.width);
}

test("desktop shell lists every destination with readable labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterWorkspace(page);

  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  for (const [label] of destinations) {
    const link = navigation.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    // Compact desktop rows, but never the 10px captions the shell once had.
    await expect(link).toHaveCSS("font-size", "14px");
  }
  await expect(
    navigation.getByRole("link", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await noHorizontalOverflow(page);
});

test("quick-ask launcher sits in the top bar and is absent on the agent page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterWorkspace(page);

  const launcher = page.getByRole("button", { name: "Open CarbonSage" });
  await expect(launcher).toBeVisible();
  const box = await launcher.boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(box).not.toBeNull();
  expect(main).not.toBeNull();
  // The launcher ends above the page content, so it can never cover it.
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
    (main?.y ?? 0) + 1,
  );

  // It must stay out of the way while scrolling, too.
  await page.mouse.wheel(0, 600);
  const scrolled = await launcher.boundingBox();
  expect(scrolled?.y ?? 99).toBeLessThanOrEqual(56);

  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Ask CarbonSage", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/agent$/);
  await expect(
    page.getByRole("button", { name: "Open CarbonSage" }),
  ).toHaveCount(0);
});

test("mobile drawer exposes all routes, traps focus, and returns focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await enterWorkspace(page);
  await noHorizontalOverflow(page);

  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeHidden();

  await menuButton.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Workspace menu" });
  await expect(drawer).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  // All eight routes plus the utilities, none hidden in a scroll strip.
  for (const [label] of destinations) {
    await expect(
      drawer.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(
    drawer.getByRole("link", { name: "How to use CarbonSage" }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: /mode$/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Sign out" })).toBeVisible();

  // Focus stays inside the drawer however far the user tabs.
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(
          document.activeElement?.closest('[role="dialog"][aria-modal="true"]'),
        ),
      ),
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();

  // Choosing a route closes the drawer, lands on the route, and keeps focus
  // on the menu button; browser back returns without the drawer reopening.
  await menuButton.click();
  await page
    .getByRole("dialog", { name: "Workspace menu" })
    .getByRole("link", { name: "Shipments", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/shipments$/);
  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard\/overview$/);
  await expect(drawer).toBeHidden();
  await noHorizontalOverflow(page);

  // The CarbonSage lockup anchors the mobile bar.
  await expect(
    page.getByRole("link", { name: "CarbonSage home" }).first(),
  ).toBeVisible();
});

test("overview reports a failed load instead of claiming the workspace is empty", async ({
  page,
}) => {
  await enterWorkspace(page);
  await page.route("**/shipments", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Simulated shipment failure" }),
    }),
  );
  await page.route("**/demo/data/bootstrap", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Shipment data could not be loaded" }),
  ).toBeVisible({ timeout: backendActionTimeout });
  await expect(page.getByText("No shipment data yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.unroute("**/shipments");
  await page.unroute("**/demo/data/bootstrap");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No shipment data yet")).toBeVisible({
    timeout: backendActionTimeout,
  });
  await expect(
    page.getByRole("heading", { name: "Shipment data could not be loaded" }),
  ).toHaveCount(0);
});

test("seeded overview shows exact values, the caveat, and table alternatives", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterWorkspace(page);
  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(
    page.getByRole("img", {
      name: "Freight emissions trend by transport mode",
    }),
  ).toBeVisible({ timeout: backendActionTimeout });

  await expect(page.getByText("Fictional demo dataset").first()).toBeVisible();
  await expect(
    page.getByText("Total emissions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("dd", { hasText: "120,629.1" }).first(),
  ).toBeAttached();
  await expect(page.getByText(/prototype-2026\.1/)).toBeVisible();

  const mix = page.getByRole("table", {
    name: /Emissions, shipments and share of total by transport mode/,
  });
  await expect(mix.getByRole("row")).toHaveCount(5); // header + four modes
  await expect(mix.getByRole("cell", { name: "63.7%" })).toBeVisible();

  const hotspots = page.getByRole("region", {
    name: "Highest-impact shipments",
  });
  await expect(
    hotspots.getByRole("rowheader", { name: "CS-1042" }),
  ).toBeVisible();

  await page.getByText("View exact emissions values").click();
  await expect(
    page.getByRole("region", { name: "Monthly emissions values by mode" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});

test("a saved dark preference survives page load", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("theme", "dark");
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
});

test("the Overview shows the decision data in the first desktop viewport", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await enterWorkspace(page);
  await page.getByRole("button", { name: "Load demo data" }).click();
  await expect(
    page.getByRole("img", {
      name: "Freight emissions trend by transport mode",
    }),
  ).toBeVisible({ timeout: backendActionTimeout });

  // A compact sidebar, and the KPI strip, trend, mode mix and the start of
  // the hotspot table all inside 900px.
  const sidebar = await page.locator("aside").boundingBox();
  expect(sidebar?.width).toBeLessThanOrEqual(232);
  for (const name of [
    "Carbon metrics",
    "Monthly freight footprint",
    "Aggregate emissions mix",
    "Highest-impact shipments",
  ]) {
    const heading = page.getByRole("heading", { name });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(860);
  }
  await noHorizontalOverflow(page);
});
