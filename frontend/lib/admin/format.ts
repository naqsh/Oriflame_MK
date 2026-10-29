const DATE_TIME = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});

/** Admin timestamps, always in Pakistan time (the store's only market). */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** A positive page number from a search param, defaulting to 1. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** A trimmed search query from a search param, at most 100 characters (the API's limit). */
export function queryParam(value: string | string[] | undefined): string {
  const text = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return text.slice(0, 100);
}
