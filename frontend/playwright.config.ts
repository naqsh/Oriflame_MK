import { defineConfig, devices } from "@playwright/test";

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 8000;

/**
 * Starts the FastAPI backend and the Next.js dev server, then runs e2e/.
 * The backend gets placeholder settings only: no real database is needed for the
 * smoke journey, and no test may reach Oriflame.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn backend.app.main:create_app --factory --port ${BACKEND_PORT}`,
      cwd: "..",
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      env: {
        POSTGRES_URL: "postgresql://localhost:5432/e2e_placeholder",
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
