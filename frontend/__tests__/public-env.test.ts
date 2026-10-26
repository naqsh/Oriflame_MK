// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Only the backend base URL may be exposed to the browser (docs/REFERRAL.md).
const ALLOWED_PUBLIC_ENV = new Set(["NEXT_PUBLIC_API_BASE_URL"]);
const SOURCE_DIRS = ["app", "components", "lib", "types"];
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(name) ? [path] : [];
  });
}

describe("public environment variables", () => {
  it("references no NEXT_PUBLIC_ variable other than NEXT_PUBLIC_API_BASE_URL", () => {
    const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap(
      (file) =>
        [...readFileSync(file, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)]
          .map((match) => match[0])
          .filter((name) => !ALLOWED_PUBLIC_ENV.has(name))
          .map((name) => `${file}: ${name}`),
    );

    expect(offenders).toEqual([]);
  });
});
