import { expect, test } from "@playwright/test";

test("homepage renders the shell and the independent-storefront disclaimer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toContainText("not the official Oriflame website");
});

test("status page shows the backend as healthy", async ({ page }) => {
  await page.goto("/status");

  await expect(page.getByText("Backend service: healthy")).toBeVisible();
});

test("robots.txt and the sitemap are served (non-production: crawling disallowed)", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/User-Agent: \*\s+Disallow: \//i);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("xml");
});
