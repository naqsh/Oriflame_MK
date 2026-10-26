"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatPrice } from "@/components/product/price";
import { useShoppingList } from "@/components/referral/shopping-list-provider";
import { getProduct } from "@/lib/api/catalogue";
import { MAX_QUANTITY, indicativeTotal, itemCount } from "@/lib/shopping-list";

type Flag = { kind: "unavailable" } | { kind: "price"; from: string | null; to: string | null };

/**
 * Checks each item once against the public product endpoint (the same request a product
 * page makes). Only that product's slug is in the URL; the list and quantities are never
 * sent. Hidden or removed products are flagged; changed prices are flagged and updated.
 */
function useFreshness() {
  const { items, replace } = useShoppingList();
  const [flags, setFlags] = useState<Record<string, Flag>>({});
  const checked = useRef(new Set<string>());

  useEffect(() => {
    const pending = items.filter((item) => !checked.current.has(item.slug));
    if (pending.length === 0) return;
    pending.forEach((item) => checked.current.add(item.slug));
    let cancelled = false;

    void Promise.all(
      pending.map(async (item) => {
        try {
          const product = await getProduct(item.slug);
          if (product === null) return [item.slug, { kind: "unavailable" }] as const;
          if (product.price_pkr !== item.price_pkr) {
            return [item.slug, { kind: "price", from: item.price_pkr, to: product.price_pkr }] as const;
          }
        } catch {
          // Best effort: an item that cannot be checked now is simply left unflagged.
        }
        return null; // unchanged, or could not be checked right now
      }),
    ).then((results) => {
      if (cancelled) return;
      const found = results.filter((result) => result !== null);
      if (found.length === 0) return;
      setFlags((previous) => ({ ...previous, ...Object.fromEntries(found) }));
      const prices = new Map(
        found.flatMap(([slug, flag]) => (flag.kind === "price" ? [[slug, flag.to] as const] : [])),
      );
      if (prices.size > 0) {
        replace(
          items.map((item) =>
            prices.has(item.slug) ? { ...item, price_pkr: prices.get(item.slug) ?? null } : item,
          ),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [items, replace]);

  return flags;
}

function FlagNote({ flag }: { flag: Flag | undefined }) {
  if (!flag) return null;
  if (flag.kind === "unavailable") {
    return <p className="text-sm text-amber-800">No longer available on this site.</p>;
  }
  return (
    <p className="text-sm text-amber-800">
      Price updated: was {formatPrice(flag.from)}, now {formatPrice(flag.to)}.
    </p>
  );
}

export function ShoppingListView() {
  const { items, persistent, setQuantity, remove } = useShoppingList();
  const flags = useFreshness();
  // Products no longer available cannot be bought, so they leave the total and count.
  const buyable = items.filter((item) => flags[item.slug]?.kind !== "unavailable");
  const unavailable = items.length - buyable.length;
  const total = indicativeTotal(buyable);
  const count = itemCount(buyable);

  return (
    <div className="space-y-6">
      {!persistent ? (
        <p role="alert" className="rounded-md border border-amber-600 px-4 py-3 text-sm">
          This browser is not letting us save your list, so it will be lost when you leave the
          site.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Your list is stored only in this browser. It is not sent to us or to Oriflame, and we
        never ask for your address or payment details.
      </p>

      {items.length === 0 ? (
        <div className="space-y-2 rounded-md border px-4 py-6">
          <p>Your list is empty.</p>
          <Link href="/products" className="text-sm underline">
            Browse products
          </Link>
        </div>
      ) : (
        <>
          <ul aria-label="Items in your list" className="divide-y rounded-md border">
            {items.map((item) => (
              <li key={item.slug} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={`/products/${item.slug}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{formatPrice(item.price_pkr)} each</p>
                  <FlagNote flag={flags[item.slug]} />
                </div>
                <div className="flex items-center gap-2" role="group" aria-label={`Quantity of ${item.name}`}>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.slug, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    aria-label={`Decrease quantity of ${item.name}`}
                    className="h-8 w-8 rounded-md border disabled:opacity-40"
                  >
                    −
                  </button>
                  <output aria-label={`Quantity of ${item.name}`} className="w-8 text-center">
                    {item.quantity}
                  </output>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.slug, item.quantity + 1)}
                    disabled={item.quantity >= MAX_QUANTITY}
                    aria-label={`Increase quantity of ${item.name}`}
                    className="h-8 w-8 rounded-md border disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.slug)}
                  aria-label={`Remove ${item.name} from your list`}
                  className="text-sm underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <section aria-labelledby="list-total" className="space-y-1">
            <h2 id="list-total" className="font-heading text-xl font-semibold">
              Indicative total: {formatPrice(total.amount)}
            </h2>
            <p className="text-sm text-muted-foreground">
              Indicative — final price on Oriflame. {count} {count === 1 ? "item" : "items"}.
            </p>
            {unavailable > 0 ? (
              <p className="text-sm text-muted-foreground">
                {unavailable} {unavailable === 1 ? "product is" : "products are"} no longer available
                and not included.
              </p>
            ) : null}
            {total.unpriced > 0 ? (
              <p className="text-sm text-muted-foreground">
                {total.unpriced} {total.unpriced === 1 ? "product has" : "products have"} no price
                here and {total.unpriced === 1 ? "is" : "are"} not included.
              </p>
            ) : null}
          </section>
          {/* Reserved: "Buy from Oriflame" handoff for the whole list (OR-E4). */}
          <div data-slot="referral-handoff" />
        </>
      )}
    </div>
  );
}
