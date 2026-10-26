import type { Metadata } from "next";

import { ShoppingListView } from "@/components/referral/shopping-list-view";

// Personal to each browser, so never indexed.
export const metadata: Metadata = {
  title: "Your shopping list",
  robots: { index: false, follow: true },
};

export default function ListPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">Your shopping list</h1>
      <ShoppingListView />
    </div>
  );
}
