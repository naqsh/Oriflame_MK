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
