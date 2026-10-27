import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

/**
 * With E2E_POSTGRES_URL (a throwaway database), prepare it for the full journeys:
 * migrate, load the development fixtures, and create a per-run admin through the CLI.
 * The generated credentials live only in this process's environment (inherited by the
 * test workers): never written to disk or committed. Without E2E_POSTGRES_URL only the
 * database-free smoke tests run.
 */
export default function globalSetup(): void {
  const databaseUrl = process.env.E2E_POSTGRES_URL;
  if (!databaseUrl) return;

  const repoRoot = resolve(__dirname, "..", "..");
  const env = { ...process.env, POSTGRES_URL: databaseUrl, APP_ENV: "development" };
  const run = (args: string[], input?: string) =>
    execFileSync("uv", ["run", ...args], { cwd: repoRoot, env, input, stdio: ["pipe", "pipe", "inherit"] });

  run(["alembic", "upgrade", "head"]);
  run(["python", "-m", "backend.app.cli", "sync", "--fixtures"]);

  const email = `e2e-${Date.now()}-${randomBytes(3).toString("hex")}@example.test`;
  const password = randomBytes(18).toString("base64url");
  run(["python", "-m", "backend.app.cli", "create-admin", email, "--password-stdin"], `${password}\n`);
  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;
}
