import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8000";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** The session token from the HttpOnly cookie, read through the test browser context. */
async function adminToken(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "admin_session");
  return cookie?.value ?? "";
}

test("admin pages redirect signed-out visitors to the login page", async ({ page }) => {
  for (const path of ["/admin", "/admin/products", "/admin/sync", "/admin/referral", "/admin/audit"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login\?reason=signin$/);
  }
});

test("the admin API rejects requests without a session, bypassing Next.js", async ({ request }) => {
  for (const path of ["/api/v1/admin/me", "/api/v1/admin/sync-runs", "/api/v1/admin/referral-status"]) {
    const response = await request.get(`${API}${path}`);
    expect(response.status()).toBe(401);
  }
  expect((await request.post(`${API}/api/v1/admin/sync`)).status()).toBe(401);
  expect((await request.get(`${API}/api/v1/admin/products`)).status()).toBe(401);
  const patch = await request.patch(`${API}/api/v1/admin/products/sample-product-06`, {
    data: { is_visible: false },
  });
  expect(patch.status()).toBe(401);
});

test.describe("with an admin account", () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "needs E2E_POSTGRES_URL (admin created per run)");

  test("sign in, see the admin pages, sign out", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveTitle(/Admin/);
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    // (Next.js also renders an empty role=alert route announcer.)
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password." })).toBeVisible();

    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText(`Signed in as ${process.env.E2E_ADMIN_EMAIL}`)).toBeVisible();

    const cookie = (await page.context().cookies()).find((c) => c.name === "admin_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain("admin_session");

    await page.getByRole("link", { name: "Catalogue sync" }).click();
    await expect(page.getByText(/Last successful sync/)).toBeVisible();
    await page.goto("/admin/referral");
    await expect(page.getByRole("heading", { name: "Handoff clicks" })).toBeVisible();
    await expect(page.getByRole("main").getByText(/restricted mode/)).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByRole("table", { name: /Admin actions/ })).toContainText("admin.login");

    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?reason=signedout$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  // Product 06: the parallel journeys only ever pick the first card, so hiding it briefly
  // cannot disturb them. The finally block restores it.
  test("hide and feature a product; the storefront follows at once", async ({ page }) => {
    test.setTimeout(90_000);
    // Chrome names "Hide<sr-only>: product</sr-only>" as "Hide : product"; match the words.
    const toggle = (verb: string) => new RegExp(String.raw`^${verb}\s*:\s*Sample Product 06$`);
    const row = () => page.getByRole("row").filter({ hasText: "Sample Product 06" });

    await signIn(page);
    await page.getByRole("link", { name: "Products" }).click();
    // Scoped to main: the site header has its own product search.
    const main = page.getByRole("main");
    await main.getByRole("searchbox", { name: /Search by name/ }).fill("Sample Product 06");
    await main.getByRole("button", { name: "Search" }).click();
    await expect(row()).toContainText("Shown");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);

    try {
      await row().getByRole("button", { name: toggle("Hide") }).click();
      await expect(row().getByRole("status")).toContainText("Hidden from the storefront.");
      await expect(row()).toContainText("Hidden by you");
      // Featuring is not offered for a hidden product.
      await expect(row().getByRole("button", { name: /^Feature/ })).toHaveCount(0);

      await page.goto("/products/sample-product-06");
      await expect(page.getByRole("main").getByText(/could not find that page/)).toBeVisible();

      await page.goto("/admin/products?q=Sample+Product+06");
      await row().getByRole("button", { name: toggle("Show") }).click();
      await expect(row()).toContainText("Shown");
      await row().getByRole("button", { name: toggle("Feature") }).click();
      await expect(row()).toContainText("Featured");

      await page.goto("/");
      const featured = page.getByRole("region", { name: "Featured products" });
      await expect(featured.getByRole("link", { name: "Sample Product 06" })).toBeVisible();

      await page.goto("/admin/audit");
      await expect(page.getByRole("table", { name: /Admin actions/ })).toContainText("product.flags_updated");
    } finally {
      // Back to shown and not featured, whatever state the test stopped in.
      const token = await adminToken(page);
      for (const data of [{ is_visible: true }, { is_featured: false }]) {
        await page.request.patch(`${API}/api/v1/admin/products/sample-product-06`, {
          data,
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });
});
