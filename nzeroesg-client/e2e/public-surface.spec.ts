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

test("the evidence story keeps all four steps in reading order and a static equivalent under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const story = page.locator("ol.story");
  const kickers = await story.locator("li .rail-label").allTextContents();
  expect(kickers).toEqual([
    "Operational input",
    "Deterministic calculation",
    "Cited supplier evidence",
    "Decision",
  ]);
  // No scroll-linked state and no pointer: the line is simply drawn.
  await expect(story).not.toHaveAttribute("data-live", "true");
  await expect(story.locator(".story-pointer")).toBeHidden();
  await expect(story.getByText("774.4 kg CO₂e")).toBeVisible();
});

test("the evidence pointer follows the scroll position when motion is allowed", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const story = page.locator("ol.story");
  await expect(story).toHaveAttribute("data-live", "true");
  const pointer = story.locator(".story-pointer");

  const steps = story.locator("li");
  await steps.nth(0).scrollIntoViewIfNeeded();
  await steps.nth(0).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(steps.nth(0)).toHaveAttribute("data-active", "true");
  const pageY = () =>
    pointer.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const first = await pageY();

  await steps.nth(3).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect(steps.nth(3)).toHaveAttribute("data-active", "true");
  await expect(steps.nth(0)).toHaveAttribute("data-active", "false");
  const last = await pageY();

  // The pointer is a page-space line travelling down the story.
  expect(last).toBeGreaterThan(first + 200);
  await expect(pointer).toBeVisible();
});

test("the evidence pointer and parallax stop when reduced motion is enabled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const story = page.locator("ol.story");
  await expect(story).toHaveAttribute("data-live", "true");
  await page.locator("#lens").scrollIntoViewIfNeeded();
  const image = page.locator("#lens [class*=will-change-transform]").first();
  await expect
    .poll(() => image.evaluate((el) => el.style.transform))
    .not.toBe("");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(story).not.toHaveAttribute("data-live", "true");
  await expect(story.locator(".story-pointer")).toBeHidden();
  await expect.poll(() => image.evaluate((el) => el.style.transform)).toBe("");
});

test("the brand lockup keeps one accessible name in each variant", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "CarbonSage home" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "CarbonSage" }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(
    page.getByRole("link", { name: "CarbonSage home" }).first(),
  ).toBeVisible();
});

test("the saved theme is applied by an inline script before hydration", async ({
  request,
}) => {
  const response = await request.get("/login");
  const html = await response.text();
  expect(html).toContain('document.documentElement.classList.add("dark")');
});
