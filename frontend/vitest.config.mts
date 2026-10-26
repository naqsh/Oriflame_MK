import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Minimal setup for OR-005; coverage thresholds and user-event arrive in OR-007.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
});
