import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8000";

test("admin pages redirect signed-out visitors to the login page", async ({ page }) => {
  for (const path of ["/admin", "/admin/sync", "/admin/referral", "/admin/audit"]) {
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
    await expect(page.getByText(/restricted mode/)).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByRole("table", { name: /Admin actions/ })).toContainText("admin.login");

    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?reason=signedout$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
