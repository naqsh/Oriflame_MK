import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { loginAction, logoutAction } from "@/app/admin/actions";
import AdminLoginPage from "@/app/admin/login/page";
import { LoginForm } from "@/components/admin/login-form";
import { adminRequest } from "@/lib/admin/api";
import { ADMIN_COOKIE, INVALID_LOGIN, LOGIN_UNAVAILABLE, TOO_MANY_ATTEMPTS } from "@/lib/admin/constants";
import { proxy } from "@/proxy";

import { renderServer } from "./render-server";
import { render } from "./test-render";

// --- Next.js server APIs, in memory -------------------------------------------------
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
const requestHeaders = new Headers();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => jar.set(name, { value, options }),
    delete: ({ name }: { name: string }) => jar.delete(name),
  }),
  headers: async () => requestHeaders,
}));

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const API = "http://localhost:8000";
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Redirect) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  jar.clear();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("loginAction", () => {
  const valid = { email: "owner@example.pk", password: "correct horse battery staple" };

  it("validates the form before calling the API", async () => {
    const state = await loginAction({ error: null }, form({ email: "nope", password: "" }));
    expect(state.fieldErrors?.email).toBe("Enter a valid email address.");
    expect(state.fieldErrors?.password).toBe("Enter your password.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the token only in an HttpOnly, SameSite=Strict cookie scoped to /admin, then redirects", async () => {
    const expires = "2026-10-27T20:00:00+00:00";
    fetchMock.mockResolvedValue(json({ token: "t".repeat(43), expires_at: expires }));
    requestHeaders.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");

    expect(await redirectOf(loginAction({ error: null }, form(valid)))).toBe("/admin");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API}/api/v1/admin/login`);
    expect(JSON.parse(String(init?.body))).toEqual(valid);
    expect((init?.headers as Record<string, string>)["X-Forwarded-For"]).toBe("203.0.113.7");
    const cookie = jar.get(ADMIN_COOKIE)!;
    expect(cookie.value).toBe("t".repeat(43));
    expect(cookie.options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/admin" });
    expect(cookie.options?.expires).toEqual(new Date(expires));
  });

  it.each([
    [401, INVALID_LOGIN],
    [429, TOO_MANY_ATTEMPTS],
    [500, LOGIN_UNAVAILABLE],
  ])("maps API status %i to a generic message and sets no cookie", async (status, message) => {
    fetchMock.mockResolvedValue(json({ detail: "x" }, status));
    expect(await loginAction({ error: null }, form(valid))).toEqual({ error: message, email: valid.email });
    expect(jar.has(ADMIN_COOKIE)).toBe(false);
  });

  it("reports the API being unreachable without leaking details", async () => {
    fetchMock.mockRejectedValue(new TypeError("connect ECONNREFUSED"));
    expect(await loginAction({ error: null }, form(valid))).toEqual({
      error: LOGIN_UNAVAILABLE,
      email: valid.email,
    });
  });
});

describe("logoutAction", () => {
  it("revokes the session with the API, clears the cookie and redirects", async () => {
    jar.set(ADMIN_COOKIE, { value: "session-token" });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await redirectOf(logoutAction())).toBe("/admin/login?reason=signedout");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API}/api/v1/admin/logout`);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer session-token");
    expect(jar.has(ADMIN_COOKIE)).toBe(false);
  });

  it("still clears the cookie when the API is unreachable", async () => {
    jar.set(ADMIN_COOKIE, { value: "session-token" });
    fetchMock.mockRejectedValue(new TypeError("down"));
    await redirectOf(logoutAction());
    expect(jar.has(ADMIN_COOKIE)).toBe(false);
  });
});

describe("adminRequest", () => {
  const schema = z.object({ ok: z.boolean() });

  it("sends the session as a bearer token and validates the response", async () => {
    jar.set(ADMIN_COOKIE, { value: "session-token" });
    fetchMock.mockResolvedValue(json({ ok: true, extra: 1 }));
    expect(await adminRequest("/thing", schema)).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API}/api/v1/admin/thing`);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer session-token");
  });

  it("redirects to sign in without a session, without calling the API", async () => {
    expect(await redirectOf(adminRequest("/thing", schema))).toBe("/admin/login?reason=signin");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to sign in when the API says the session expired", async () => {
    jar.set(ADMIN_COOKIE, { value: "old" });
    fetchMock.mockResolvedValue(json({ detail: "Authentication required." }, 401));
    expect(await redirectOf(adminRequest("/thing", schema))).toBe("/admin/login?reason=expired");
  });
});

describe("proxy", () => {
  it.each(["/admin", "/admin/sync"])("redirects signed-out visitors from %s to the login page", (path) => {
    const response = proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login?reason=signin");
  });

  it("lets the login page and signed-in visitors through", () => {
    expect(proxy(new NextRequest("http://localhost:3000/admin/login")).headers.get("location")).toBeNull();
    const signedIn = new NextRequest("http://localhost:3000/admin/sync", {
      headers: { cookie: `${ADMIN_COOKIE}=abc` },
    });
    expect(proxy(signedIn).headers.get("location")).toBeNull();
  });
});

describe("login page", () => {
  const props = (reason?: string) => ({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(reason ? { reason } : {}),
  });

  it("shows the CLI setup step, never a registration form, when no admin exists", async () => {
    fetchMock.mockResolvedValue(json({ has_admin: false }));
    await renderServer(AdminLoginPage(props()));
    expect(screen.getByText(/create-admin/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("shows the sign-in form and the expiry notice", async () => {
    fetchMock.mockResolvedValue(json({ has_admin: true }));
    await renderServer(AdminLoginPage(props("expired")));
    expect(screen.getByRole("heading", { level: 1, name: "Admin sign in" })).toBeInTheDocument();
    expect(screen.getByText(/session has ended/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});

describe("LoginForm", () => {
  it("submits with the keyboard and announces errors accessibly", async () => {
    const action = vi.fn(async () => ({
      error: INVALID_LOGIN,
      fieldErrors: { email: "Enter a valid email address." },
    }));
    render(<LoginForm action={action} />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.pk");
    await userEvent.type(screen.getByLabelText("Password"), "secret{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_LOGIN);
    expect(action).toHaveBeenCalledTimes(1);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Enter a valid email address.");
  });

  it("keeps the email after a failed attempt (React resets the form after an action)", async () => {
    const action = vi.fn(async () => ({ error: INVALID_LOGIN, email: "owner@example.pk" }));
    render(<LoginForm action={action} />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.pk");
    await userEvent.type(screen.getByLabelText("Password"), "wrong{Enter}");

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email")).toHaveValue("owner@example.pk");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});
