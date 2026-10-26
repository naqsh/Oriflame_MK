import { z } from "zod";

import { SLUG_PATTERN } from "@/lib/api/schemas/catalogue";

/**
 * Shopping list kept only in this browser (OR-027). No account, no payment, no
 * address: items hold a product slug, its name, a quantity and the price seen when it
 * was added. Nothing here sends the list anywhere.
 */

/** Versioned so a future format can discard old data instead of misreading it. */
export const STORAGE_KEY = "oriflame-mk.shopping-list.v1";
export const MAX_QUANTITY = 99;
export const MAX_ITEMS = 100;

const PRICE = /^\d{1,10}(\.\d{1,2})?$/;

const itemSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN).max(200),
  name: z.string().min(1).max(300),
  quantity: z.int().min(1).max(MAX_QUANTITY),
  price_pkr: z.string().regex(PRICE).nullable(),
});

const storedSchema = z.object({
  version: z.literal(1),
  items: z.array(itemSchema).max(MAX_ITEMS),
});

export type ListItem = z.infer<typeof itemSchema>;
export type ListProduct = Pick<ListItem, "slug" | "name" | "price_pkr">;

/** Items from stored JSON; anything corrupt, foreign or from another version is dropped. */
export function parseStored(raw: string | null): ListItem[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = storedSchema.safeParse(data);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  return parsed.data.items.filter((item) => !seen.has(item.slug) && seen.add(item.slug));
}

export function serialise(items: ListItem[]): string {
  return JSON.stringify({ version: 1, items });
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

export function addItem(items: ListItem[], product: ListProduct): ListItem[] {
  const existing = items.find((item) => item.slug === product.slug);
  if (existing) {
    return setQuantity(items, product.slug, existing.quantity + 1);
  }
  if (items.length >= MAX_ITEMS) return items;
  return [...items, { ...product, quantity: 1 }];
}

export function setQuantity(items: ListItem[], slug: string, quantity: number): ListItem[] {
  return items.map((item) =>
    item.slug === slug ? { ...item, quantity: clampQuantity(quantity) } : item,
  );
}

export function removeItem(items: ListItem[], slug: string): ListItem[] {
  return items.filter((item) => item.slug !== slug);
}

export function itemCount(items: ListItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Indicative total of priced items, in paisa to avoid floating-point drift.
 * `unpriced` counts items without a known price, which the total leaves out.
 */
export function indicativeTotal(items: ListItem[]): { amount: string; unpriced: number } {
  let paisa = 0;
  let unpriced = 0;
  for (const item of items) {
    if (item.price_pkr === null) {
      unpriced += 1;
      continue;
    }
    const [rupees, fraction = ""] = item.price_pkr.split(".");
    paisa += (Number(rupees) * 100 + Number(fraction.padEnd(2, "0"))) * item.quantity;
  }
  const amount = `${Math.floor(paisa / 100)}.${String(paisa % 100).padStart(2, "0")}`;
  return { amount, unpriced };
}

/** Storage that may be unavailable (private mode, blocked, quota exceeded). */
export interface ListStorage {
  /** False when nothing can be stored (no window, blocked or disabled storage). */
  available(): boolean;
  read(): string | null;
  /** False when the browser refused to store the list. */
  write(value: string): boolean;
}

export function browserStorage(): ListStorage {
  return {
    available() {
      try {
        const probe = `${STORAGE_KEY}.probe`;
        window.localStorage.setItem(probe, "1");
        window.localStorage.removeItem(probe);
        return true;
      } catch {
        return false;
      }
    },
    read() {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}
