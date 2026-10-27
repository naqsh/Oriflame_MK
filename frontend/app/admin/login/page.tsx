import { connection } from "next/server";
import { Suspense } from "react";

import { loginAction } from "@/app/admin/actions";
import { LoginForm } from "@/components/admin/login-form";
import { setupStatusSchema } from "@/lib/admin/schemas";
import { ApiError, fetchJson } from "@/lib/api/client";

const NOTICES: Record<string, string> = {
  expired: "Your session has ended. Please sign in again.",
  signedout: "You have signed out.",
  signin: "Please sign in to continue.",
};

async function LoginContent({ searchParams }: PageProps<"/admin/login">) {
  await connection();
  const reason = (await searchParams).reason;
  const notice = typeof reason === "string" ? NOTICES[reason] : undefined;

  let hasAdmin = true;
  try {
    hasAdmin = (await fetchJson("/api/v1/admin/setup", setupStatusSchema)).has_admin;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`admin_setup_check_failed kind=${error.kind} status=${error.status ?? "-"}`);
  }

  if (!hasAdmin) {
    // Never an open registration page: the first admin is created on the server.
    return (
      <div className="max-w-xl space-y-3">
        <p>No admin account exists yet. Create one on the server with:</p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">
          uv run python -m backend.app.cli create-admin you@example.com
        </pre>
        <p className="text-sm text-muted-foreground">
          You will be asked for a password (at least 12 characters). Then reload this page.
        </p>
      </div>
    );
  }
  return (
    <>
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <LoginForm action={loginAction} />
    </>
  );
}

export default function AdminLoginPage(props: PageProps<"/admin/login">) {
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-3xl font-semibold">Admin sign in</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <LoginContent {...props} />
      </Suspense>
    </section>
  );
}
