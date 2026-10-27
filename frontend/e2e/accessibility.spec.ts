import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

/**
 * Automated WCAG 2.2 A/AA checks (axe) on every page template. Axe finds roughly a third
 * of accessibility problems; keyboard and screen reader checks stay manual (docs/SECURITY.md
 * lists none, frontend/AGENT.md "Accessibility" lists them). Pages without catalogue data
 * always run; catalogue pages need E2E_POSTGRES_URL, like the other journeys.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  // Streamed sections render skeletons (animate-pulse) first; check the final page.
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The Next.js dev overlay is not part of the site.
    .exclude("nextjs-portal")
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route(/oriflame\.com/, (route) => route.abort("blockedbyclient"));
});

const STATIC_PAGES = [
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/referral",
  "/guides",
  "/guides/how-to-order-oriflame-products-in-pakistan",
  "/list",
  "/admin/login",
];

for (const path of STATIC_PAGES) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expectNoViolations(page);
  });
}

test.describe("catalogue pages", () => {
  test.skip(!process.env.E2E_POSTGRES_URL, "needs E2E_POSTGRES_URL (development fixtures)");

  test("home, listing, category, product and search", async ({ page }) => {
    for (const path of ["/", "/products", "/search?q=Sample", "/search?q=qxzvbnmw"]) {
      await page.goto(path);
      await expectNoViolations(page);
    }

    await page.goto("/");
    await page.getByRole("navigation", { name: "Categories" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/categories\//);
    await expectNoViolations(page);

    await page.getByRole("link", { name: /Sample Product/ }).first().click();
    await expect(page).toHaveURL(/\/products\//);
    await expectNoViolations(page);
  });

  test("shopping list with an item and the Oriflame dialog open", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("link", { name: /Sample Product/ }).first().click();
    await page.getByRole("button", { name: /^Add to list/ }).first().click();
    await page.getByRole("link", { name: "Shopping list, 1 item" }).click();
    await expect(page).toHaveURL(/\/list$/);
    await expectNoViolations(page);

    await page.getByRole("button", { name: "Buy these on Oriflame" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page);
  });
});
