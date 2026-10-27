import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_POSTGRES_URL, "needs E2E_POSTGRES_URL (development fixtures)");

test.beforeEach(async ({ page }) => {
  // Never reach the real Oriflame site: any request to it fails the test loudly.
  await page.route(/oriflame\.com/, (route) => route.abort("blockedbyclient"));
});

test("homepage → category → product → list → Buy from Oriflame handoff", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  await page.getByRole("navigation", { name: "Categories" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/categories\//);

  // The whole tile is clickable, not just the title link (stretched link overlay).
  // Click the image area: the title link's overlay covers it and takes the click.
  await page.getByRole("article").first().click({ position: { x: 40, y: 40 } });
  await expect(page).toHaveURL(/\/products\//);
  const productName = (await page.getByRole("heading", { level: 1 }).textContent())?.trim() ?? "";
  expect(productName).toMatch(/Sample Product/);
  await expect(page.getByText("Availability not confirmed").first()).toBeVisible();

  await page.getByRole("button", { name: /^Add to list/ }).first().click();
  await expect(page.getByRole("link", { name: "Shopping list, 1 item" })).toBeVisible();

  await page.getByRole("link", { name: "Shopping list, 1 item" }).click();
  await expect(page).toHaveURL(/\/list$/);
  await expect(page.getByText(productName).first()).toBeVisible();

  // Restricted mode (no referral configured): a dialog with a plain Oriflame link.
  await page.getByRole("button", { name: "Buy these on Oriflame" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(productName);
  const continueLink = dialog.getByRole("link", { name: /Continue to Oriflame/ });
  const href = await continueLink.getAttribute("href");
  expect(new URL(href ?? "").host).toBe("pk.oriflame.com");
  await expect(continueLink).toHaveAttribute("rel", /noopener/);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("search finds products and explains when nothing matches", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search").getByRole("searchbox", { name: "Search products" });
  await search.fill("Sample Product");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Sample/);
  await expect(page.getByRole("link", { name: /Sample Product/ }).first()).toBeVisible();

  // No real word in it, so neither full-text nor fuzzy matching can find anything.
  await page.goto("/search?q=qxzvbnmw");
  await expect(page.getByText(/No products matched your search/)).toBeVisible();
});
