import { type RenderOptions, render as rtlRender } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { ShoppingListProvider } from "@/components/referral/shopping-list-provider";
import type { ListStorage } from "@/lib/shopping-list";

/** In-memory ListStorage for tests; `fail` simulates blocked or full browser storage. */
export function memoryStorage(initial: string | null = null, { fail = false } = {}) {
  let value = initial;
  const storage: ListStorage & { value(): string | null } = {
    available: () => !fail,
    read: () => (fail ? null : value),
    write: (next) => {
      if (fail) return false;
      value = next;
      return true;
    },
    value: () => value,
  };
  return storage;
}

/**
 * RTL render with the app-wide ShoppingListProvider (fresh in-memory storage per call).
 * Not a test file: Vitest only collects *.test.ts[x].
 */
export function render(ui: ReactElement, options: Omit<RenderOptions, "wrapper"> = {}) {
  const storage = memoryStorage();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ShoppingListProvider storage={storage}>{children}</ShoppingListProvider>
  );
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}
