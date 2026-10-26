import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("has exactly one h1 and no product listings", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says checkout happens on the official Oriflame website", () => {
    render(<HomePage />);

    expect(screen.getByText(/official website/i)).toBeInTheDocument();
  });
});
