/**
 * Turn source text that may contain HTML into plain paragraphs.
 *
 * Source HTML is never rendered: tags are dropped (block tags become paragraph breaks),
 * a few common entities are decoded, and the result is rendered by React as text, so
 * any markup or script that survives is shown escaped, never executed.
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return safeCodePoint(Number.parseInt(code.slice(2), 16)) ?? match;
    }
    if (code.startsWith("#")) return safeCodePoint(Number.parseInt(code.slice(1), 10)) ?? match;
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function safeCodePoint(value: number): string | undefined {
  if (!Number.isInteger(value) || value <= 0 || value > 0x10ffff) return undefined;
  return String.fromCodePoint(value);
}

export function toParagraphs(source: string | null | undefined): string[] {
  if (!source) return [];
  const withBreaks = source
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|ul|ol|section|article)\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(withBreaks)
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/[ \t]*\n[ \t]*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
