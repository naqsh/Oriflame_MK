import { describe, expect, it } from "vitest";

import { toParagraphs } from "@/lib/text";

describe("toParagraphs", () => {
  it("returns nothing for empty input", () => {
    expect(toParagraphs(null)).toEqual([]);
    expect(toParagraphs(undefined)).toEqual([]);
    expect(toParagraphs("   ")).toEqual([]);
  });

  it("keeps plain text and splits on blank lines", () => {
    expect(toParagraphs("First line\ncontinues.\n\nSecond paragraph.")).toEqual([
      "First line continues.",
      "Second paragraph.",
    ]);
  });

  it("drops tags, turning block elements into paragraphs", () => {
    expect(
      toParagraphs("<p>Soft <b>glow</b> finish.</p><ul><li>Light</li><li>Matte</li></ul>Line<br>break"),
    ).toEqual(["Soft glow finish.", "Light", "Matte", "Line break"]);
  });

  it("removes scripts and styles with their content", () => {
    const paragraphs = toParagraphs(
      "<p>Safe</p><script>alert('x')</script><style>p{display:none}</style><p>Text</p>",
    );
    expect(paragraphs).toEqual(["Safe", "Text"]);
    expect(paragraphs.join(" ")).not.toMatch(/alert|display/);
  });

  it("drops attributes, including event handlers", () => {
    expect(toParagraphs('<img src=x onerror="alert(1)"><a href="javascript:x">Link</a>')).toEqual(["Link"]);
  });

  it("decodes common entities without creating markup", () => {
    expect(toParagraphs("A &amp; B &lt;b&gt;bold&lt;/b&gt; &#39;q&#39; &#x2764; &bogus;")).toEqual([
      "A & B <b>bold</b> 'q' ❤ &bogus;",
    ]);
    expect(toParagraphs("&#0; &#99999999;")).toEqual(["&#0; &#99999999;"]);
  });
});
