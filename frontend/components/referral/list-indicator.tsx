"use client";

import Link from "next/link";

import { useShoppingList } from "@/components/referral/shopping-list-provider";
import { itemCount } from "@/lib/shopping-list";

/** Header link to /list with the number of items. */
export function ListIndicator() {
  const { items } = useShoppingList();
  const count = itemCount(items);
  return (
    <Link
      href="/list"
      aria-label={`Shopping list, ${count} ${count === 1 ? "item" : "items"}`}
      className="rounded-md border px-3 py-1.5 text-sm whitespace-nowrap hover:border-foreground"
    >
      List ({count})
    </Link>
  );
}
