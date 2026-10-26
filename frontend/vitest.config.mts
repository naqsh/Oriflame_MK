import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      // Route shell files are covered by Playwright (e2e/), not Vitest.
      exclude: ["app/layout.tsx", "app/**/page.tsx"],
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 75,
        // docs: 90% for API and SEO utilities.
        "lib/api/**": { lines: 90 },
        "lib/seo/**": { lines: 90 },
      },
    },
  },
});
