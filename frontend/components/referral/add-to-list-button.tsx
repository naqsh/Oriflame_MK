"use client";

import Link from "next/link";

import { useShoppingList } from "@/components/referral/shopping-list-provider";
import type { ListProduct } from "@/lib/shopping-list";
import { cn } from "@/lib/utils/cn";

/** "Add to list" for cards and the product page; adds one more each time it is pressed. */
export function AddToListButton({ product, className }: { product: ListProduct; className?: string }) {
  const { items, add } = useShoppingList();
  const inList = items.find((item) => item.slug === product.slug);
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <button
        type="button"
        onClick={() => add(product)}
        className="rounded-md border px-3 py-1.5 font-medium hover:border-foreground"
      >
        {/* The spoken name starts with the visible words, so voice control works (WCAG 2.5.3). */}
        Add to list<span className="sr-only">: {product.name}</span>
      </button>
      {inList ? (
        <Link href="/list" className="text-muted-foreground underline">
          {inList.quantity} in your list
        </Link>
      ) : null}
    </div>
  );
}
