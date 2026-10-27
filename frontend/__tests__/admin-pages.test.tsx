import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditTable } from "@/components/admin/audit-table";
import { formatDateTime, pageParam } from "@/lib/admin/format";
import type { AuditPage } from "@/lib/admin/schemas";

import { render } from "./test-render";

function auditPage(overrides: Partial<AuditPage> = {}): AuditPage {
  return {
    items: [
      {
        id: 2,
        occurred_at: "2026-10-27T07:00:00Z",
        admin_user_id: 1,
        action: "admin.login",
        target_type: null,
        target_id: null,
        details: {},
      },
      {
        id: 1,
        occurred_at: "2026-10-27T06:00:00Z",
        admin_user_id: null,
        action: "admin.login_failed",
        target_type: "catalogue",
        target_id: "run-3",
        details: { reason: "unknown_email" },
      },
    ],
    total: 30,
    page: 1,
    page_size: 25,
    ...overrides,
  };
}

describe("admin formatting", () => {
  it("shows Pakistan time", () => {
    expect(formatDateTime("2026-10-27T07:00:00Z")).toMatch(/12:00/);
  });

  it.each([
    [undefined, 1],
    ["3", 3],
    [["4", "5"], 4],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["abc", 1],
    ["99999", 1],
  ])("pageParam(%j) = %i", (value, expected) => {
    expect(pageParam(value as string | string[] | undefined)).toBe(expected);
  });
});

describe("AuditTable", () => {
  it("lists actions in an accessible table with details and paging", () => {
    render(<AuditTable data={auditPage()} />);

    const table = screen.getByRole("table", { name: "Admin actions, newest first" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("admin.login")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("reason: unknown_email")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("catalogue run-3")).toBeInTheDocument();

    const paging = screen.getByRole("navigation", { name: "Audit log pages" });
    expect(within(paging).getByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(paging).getByRole("link", { name: "Older →" })).toHaveAttribute("href", "/admin/audit?page=2");
    expect(within(paging).queryByRole("link", { name: "← Newer" })).not.toBeInTheDocument();
  });

  it("says so when nothing has been recorded", () => {
    render(<AuditTable data={auditPage({ items: [], total: 0 })} />);
    expect(screen.getByText("No admin actions recorded yet.")).toBeInTheDocument();
  });
});
