import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startSyncAction } from "@/app/admin/sync/actions";
import { ReferralClicksTable, ReferralStatusCard } from "@/components/admin/referral-overview";
import { RunSyncButton } from "@/components/admin/run-sync-button";
import { SyncRunsTable, syncAge } from "@/components/admin/sync-runs-table";
import { ADMIN_COOKIE } from "@/lib/admin/constants";
import type { ReferralClicks, SyncRuns } from "@/lib/admin/schemas";

import { render } from "./test-render";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));
class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  jar.clear();
  fetchMock.mockReset();
  revalidatePath.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const runs: SyncRuns = {
  items: [
    {
      id: 2,
      source: "dev_fixture",
      status: "failed",
      started_at: "2026-10-27T07:00:00Z",
      finished_at: "2026-10-27T07:01:00Z",
      created_count: 0,
      updated_count: 0,
      unchanged_count: 0,
      error_count: 1,
      error_detail: "Source unreachable",
    },
    {
      id: 1,
      source: "dev_fixture",
      status: "success",
      started_at: "2026-10-26T07:00:00Z",
      finished_at: "2026-10-26T07:01:00Z",
      created_count: 12,
      updated_count: 0,
      unchanged_count: 0,
      error_count: 0,
      error_detail: null,
    },
  ],
  total: 2,
  page: 1,
  page_size: 20,
  last_success_at: "2026-10-26T07:01:00Z",
};

describe("sync status", () => {
  it.each([
    [null, "No successful sync yet"],
    ["2026-10-27T11:59:00Z", "1 minute ago"],
    ["2026-10-27T09:00:00Z", "3 hours ago"],
    ["2026-10-20T12:00:00Z", "7 days ago"],
  ])("syncAge(%s)", (value, expected) => {
    expect(syncAge(value, new Date("2026-10-27T12:00:00Z"))).toBe(expected);
  });

  it("lists runs with status, counts and error detail", () => {
    render(<SyncRunsTable data={runs} />);
    const rows = within(screen.getByRole("table", { name: /sync runs/ })).getAllByRole("row");
    expect(within(rows[1]!).getByText("Failed")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Source unreachable")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("12 / 0 / 0 / 0")).toBeInTheDocument();
  });

  it("says when no sync has run", () => {
    render(<SyncRunsTable data={{ ...runs, items: [], total: 0, last_success_at: null }} />);
    expect(screen.getByText("No sync has run yet.")).toBeInTheDocument();
  });
});

describe("RunSyncButton", () => {
  it("asks for confirmation, then runs the action and announces the result", async () => {
    const action = vi.fn(async () => ({ ok: false, message: "A catalogue sync is already running." }));
    render(<RunSyncButton action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Run sync now" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Run sync now" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, start sync" }));
    expect(await screen.findByRole("status")).toHaveTextContent("already running");
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("startSyncAction", () => {
  it("starts the sync with the bearer token and revalidates the page", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "started" }), { status: 202 }));

    expect(await startSyncAction()).toEqual({
      ok: true,
      message: "Sync started. Refresh this page to follow its progress.",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:8000/api/v1/admin/sync");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/sync");
  });

  it("passes the API's refusal through", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "A catalogue sync is already running." }), { status: 409 }),
    );
    expect(await startSyncAction()).toEqual({ ok: false, message: "A catalogue sync is already running." });
  });

  it("redirects without a session or on an expired one", async () => {
    await expect(startSyncAction()).rejects.toThrow(Redirect);
    expect(fetchMock).not.toHaveBeenCalled();

    jar.set(ADMIN_COOKIE, "old");
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(startSyncAction()).rejects.toThrow(Redirect);
  });

  it("reports an unreachable API", async () => {
    jar.set(ADMIN_COOKIE, "tok");
    fetchMock.mockRejectedValue(new TypeError("down"));
    expect((await startSyncAction()).ok).toBe(false);
  });
});

describe("referral admin", () => {
  it("shows the masked code and says settings are managed in deployment", () => {
    render(
      <ReferralStatusCard
        setup={{
          method: "manual_code",
          status: "configured",
          referral_host: null,
          masked_code: "•••••••••••42",
          managed_by: "Deployment environment settings",
        }}
      />,
    );
    expect(screen.getByText("•••••••••••42")).toBeInTheDocument();
    expect(screen.getByText(/managed through deployment environment settings/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); // no edit form
  });

  it("explains restricted mode when not configured", () => {
    render(
      <ReferralStatusCard
        setup={{
          method: "official_url",
          status: "not_configured",
          referral_host: null,
          masked_code: null,
          managed_by: "Deployment environment settings",
        }}
      />,
    );
    expect(screen.getByText(/restricted mode/)).toBeInTheDocument();
  });

  it("labels counts as handoff clicks, never sales or conversions", () => {
    const clicks: ReferralClicks = {
      start: "2026-10-26",
      end: "2026-10-27",
      total: 3,
      by_origin: { pdp: 2, list: 1 },
      days: [
        { day: "2026-10-26", total: 1, by_method: { official_url: 1 } },
        { day: "2026-10-27", total: 2, by_method: { official_url: 1, manual_code: 1 } },
      ],
    };
    const { container } = render(<ReferralClicksTable clicks={clicks} />);
    expect(screen.getByRole("heading", { name: "Handoff clicks" })).toBeInTheDocument();
    expect(screen.getByText(/Product pages: 2, Shopping list: 1/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
    const text = container.textContent ?? "";
    expect(text).toMatch(/not sales/);
    expect(text.replace(/not sales/g, "")).not.toMatch(/\bsales?\b|conversions?|revenue/i);
  });
});
