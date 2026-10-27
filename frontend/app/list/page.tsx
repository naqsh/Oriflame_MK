import type { Metadata } from "next";

import { ShoppingListView } from "@/components/referral/shopping-list-view";
import { buildMetadata } from "@/lib/seo/metadata";

// Personal to each browser, so never indexed.
export const metadata: Metadata = buildMetadata({
  title: "Your shopping list",
  description: "Your shopping list, kept only in this browser.",
  path: "/list",
  noindex: true,
});

export default function ListPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">Your shopping list</h1>
      <ShoppingListView />
    </div>
  );
}
