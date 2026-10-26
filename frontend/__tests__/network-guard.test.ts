import { describe, expect, it } from "vitest";

describe("test network guard", () => {
  it("rejects fetch calls a test has not stubbed", async () => {
    await expect(fetch("https://pk.oriflame.com/")).rejects.toThrow(/Network blocked in tests/);
  });
});
