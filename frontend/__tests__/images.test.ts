import { describe, expect, it } from "vitest";

import { AUTHORISED_IMAGE_HOSTS, authorisedImageSrc } from "@/lib/images";

describe("authorisedImageSrc", () => {
  it("has no authorised remote hosts while ADR-001 is Proposed", () => {
    expect(AUTHORISED_IMAGE_HOSTS).toEqual([]);
  });

  it.each([
    ["http://localhost:3000/dev-fixture/sample-product.svg", "/dev-fixture/sample-product.svg"],
    ["http://127.0.0.1:3000/dev-fixture/a.svg", "/dev-fixture/a.svg"],
  ])("renders local development placeholders from their path: %s", (url, expected) => {
    expect(authorisedImageSrc(url)).toBe(expected);
  });

  it.each([
    "https://media-cdn.oriflame.com/productImage?externalMediaId=1",
    "https://pk.oriflame.com/image.jpg",
    "https://evil.example.com/dev-fixture/a.svg",
    "http://localhost:3000/uploads/a.svg",
    "http://localhost:3000/dev-fixture/a.svg?v=1",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "not a url",
  ])("refuses %s", (url) => {
    expect(authorisedImageSrc(url)).toBeNull();
  });
});
