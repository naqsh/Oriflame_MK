// DELIBERATE CI FAILURE (OR-008 check). This commit is reverted immediately.
import { expect, it } from "vitest";

it("must go red", () => {
  expect(1).toBe(2);
});
