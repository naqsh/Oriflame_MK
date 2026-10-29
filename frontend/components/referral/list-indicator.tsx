"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useShoppingList } from "@/components/referral/shopping-list-provider";
import { itemCount } from "@/lib/shopping-list";

/**
 * Header link to /list with the number of items. The number bumps when it goes up, so
 * "Add to list" visibly lands here; not on first render or when items are removed.
 */
export function ListIndicator() {
  const { items } = useShoppingList();
  const count = itemCount(items);
  const previous = useRef(count);
  const [bumps, setBumps] = useState(0);
  useEffect(() => {
    if (count > previous.current) setBumps((n) => n + 1);
    previous.current = count;
  }, [count]);
  return (
    <Link
      href="/list"
      aria-label={`Shopping list, ${count} ${count === 1 ? "item" : "items"}`}
      className="rounded-md border px-3 py-1.5 text-sm whitespace-nowrap hover:border-foreground"
    >
      List (
      <span key={bumps} data-bumped={bumps > 0 || undefined} className={bumps > 0 ? "list-bump" : undefined}>
        {count}
      </span>
      )
    </Link>
  );
}
