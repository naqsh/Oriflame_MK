"use client";

import { useActionState } from "react";

import type { LoginState } from "@/lib/admin/constants";

type LoginAction = (state: LoginState, formData: FormData) => Promise<LoginState>;

/** Admin sign-in form. Validation and the API call happen in the Server Action. */
export function LoginForm({ action }: { action: LoginAction }) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-sm space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-md border border-red-600 px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="space-y-1">
        <label htmlFor="admin-email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          maxLength={254}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "admin-email-error" : undefined}
          className="w-full rounded-md border px-3 py-2"
        />
        {errors.email ? (
          <p id="admin-email-error" className="text-sm text-red-700">
            {errors.email}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="admin-password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "admin-password-error" : undefined}
          className="w-full rounded-md border px-3 py-2"
        />
        {errors.password ? (
          <p id="admin-password-error" className="text-sm text-red-700">
            {errors.password}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
