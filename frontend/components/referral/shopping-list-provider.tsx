"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type ListItem,
  type ListProduct,
  type ListStorage,
  STORAGE_KEY,
  addItem,
  browserStorage,
  parseStored,
  removeItem,
  serialise,
  setQuantity,
} from "@/lib/shopping-list";

const EMPTY: ListItem[] = [];

/**
 * External store over browser storage. If the browser refuses to store (blocked,
 * private mode, quota exceeded) it switches to memory for the rest of the visit.
 */
export function createListStore(storage: ListStorage) {
  let persistent = storage.available();
  let memory: string | null = null;
  let cache: { raw: string | null | undefined; items: ListItem[] } = { raw: undefined, items: EMPTY };
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) listener(); // another tab changed the list
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot(): ListItem[] {
      const raw = persistent ? storage.read() : memory;
      if (raw !== cache.raw) cache = { raw, items: parseStored(raw) };
      return cache.items;
    },
    isPersistent: () => persistent,
    set(items: ListItem[]) {
      const value = serialise(items);
      if (persistent && !storage.write(value)) persistent = false;
      if (!persistent) memory = value;
      notify();
    },
  };
}

type ListStore = ReturnType<typeof createListStore>;

interface ShoppingListValue {
  items: ListItem[];
  /** False when the list only lives in memory and is lost on leaving the site. */
  persistent: boolean;
  add(product: ListProduct): void;
  setQuantity(slug: string, quantity: number): void;
  remove(slug: string): void;
  replace(items: ListItem[]): void;
}

const ShoppingListContext = createContext<ShoppingListValue | null>(null);

export function ShoppingListProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage?: ListStorage;
}) {
  const store: ListStore = useMemo(() => createListStore(storage ?? browserStorage()), [storage]);
  // The server and the first client render see an empty list, so hydration matches.
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY);
  const persistent = useSyncExternalStore(store.subscribe, store.isPersistent, () => true);
  const [announcement, setAnnouncement] = useState("");

  const update = useCallback(
    (next: ListItem[], message: string) => {
      store.set(next);
      setAnnouncement(message);
    },
    [store],
  );

  const value = useMemo<ShoppingListValue>(
    () => ({
      items,
      persistent,
      add: (product) => update(addItem(store.getSnapshot(), product), `${product.name} added to your list.`),
      setQuantity: (slug, quantity) => {
        const next = setQuantity(store.getSnapshot(), slug, quantity);
        const item = next.find((entry) => entry.slug === slug);
        update(next, item ? `${item.name}: quantity ${item.quantity}.` : "");
      },
      remove: (slug) => {
        const item = store.getSnapshot().find((entry) => entry.slug === slug);
        update(removeItem(store.getSnapshot(), slug), item ? `${item.name} removed from your list.` : "");
      },
      replace: (next) => store.set(next),
    }),
    [items, persistent, store, update],
  );

  return (
    <ShoppingListContext.Provider value={value}>
      {children}
      {/* Announces list changes to screen readers. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList(): ShoppingListValue {
  const value = useContext(ShoppingListContext);
  if (!value) throw new Error("useShoppingList must be used inside ShoppingListProvider");
  return value;
}
