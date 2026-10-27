import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;

/**
 * Starts the FastAPI backend and the Next.js dev server, then runs e2e/.
 * Without E2E_POSTGRES_URL the backend gets a placeholder database and only the
 * database-free smoke and protection tests run. With it (a throwaway database), the
 * global setup migrates it, loads the development fixtures and creates a per-run admin,
 * and the full journeys run. Referral settings stay empty (restricted mode), and no
 * test may reach Oriflame.
 */
const DATABASE_URL = process.env.E2E_POSTGRES_URL || "postgresql://localhost:5432/e2e_placeholder";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The dev server compiles each route on first visit, which can take several seconds.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn backend.app.main:create_app --factory --port ${BACKEND_PORT}`,
      cwd: "..",
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      env: {
        POSTGRES_URL: DATABASE_URL,
        APP_ENV: "test",
        CORS_ORIGINS: `http://localhost:${FRONTEND_PORT}`,
        ORIFLAME_CONSULTANT_CODE: "",
        ORIFLAME_REFERRAL_URL: "",
        ORIFLAME_REFERRAL_METHOD: "official_url",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      env: { NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${BACKEND_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
