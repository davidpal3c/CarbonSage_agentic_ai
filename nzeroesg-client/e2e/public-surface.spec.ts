import { expect, type Page, test } from "@playwright/test";

// Checks for the public editorial surface and its separation from the
// workspace tokens: the demo path, honest copy, scoped colours, mobile menu,
// overflow at the review widths, and reduced motion.

const widths = [1440, 768, 430, 375] as const;

async function noHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(size.documentWidth).toBeLessThanOrEqual(size.width);
}

test("the demo call to action is above the fold on desktop and phone", async ({
  page,
}) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const cta = page
      .getByRole("link", { name: "Try the demo", exact: true })
      .first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect((box?.y ?? height) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
  }
  await page.getByRole("link", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Enter the demo workspace" }),
  ).toBeVisible();
});

test("homepage keeps the claims honest about the freight demo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /See the evidence behind Scope/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/using a fictional dataset/).first(),
  ).toBeVisible();
  await expect(page.getByText(/Not available today/)).toBeVisible();
  const text = (await page.locator("main").innerText()).toLowerCase();
  expect(text).not.toContain("marketplace");
  expect(text).not.toContain("cloud supplier");
});

test("public tokens do not reach the workspace, and the glimpse shows workspace tokens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const publicBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  const glimpseBackground = await page
    .locator("figure.surface-workspace")
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard\/overview$/, { timeout: 30_000 });
  const workspaceBackground = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  // The homepage product glimpse is painted with the real workspace surface;
  // the public page itself is a different (warm paper) ground.
  expect(glimpseBackground).toBe(workspaceBackground);
  expect(publicBackground).not.toBe(workspaceBackground);
});

test("the public pages have no horizontal overflow at the review widths", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/login"]) {
      await page.goto(path);
      await noHorizontalOverflow(page);
    }
  }
});

test("the public menu opens, lists every section, and closes with Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  const nav = page.locator("#mobile-menu");
  for (const name of [
    "How it works",
    "Freight demo",
    "Product",
    "Trust and limits",
  ]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});

test("keyboard focus is visible on the primary action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const cta = page
    .locator("#top")
    .getByRole("link", { name: "Try the demo" })
    .first();
  await cta.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(cta).toBeFocused();
  await expect(cta).toHaveCSS("outline-style", "solid");
});

test("reduced motion leaves the public pages without running animations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await page.waitForTimeout(500);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    );
    expect(running).toBe(0);
  }
});
