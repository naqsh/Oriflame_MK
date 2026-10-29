"use client";

import { useActionState } from "react";

import type { ProductFlagState } from "@/lib/admin/constants";

type FlagAction = (previous: ProductFlagState | null, form: FormData) => Promise<ProductFlagState>;

/**
 * One toggle in the admin product table. The visible verb comes first in the accessible
 * name, with the product added for screen readers (WCAG 2.5.3).
 */
export function ProductFlagButton({
  action,
  slug,
  productName,
  field,
  value,
  label,
}: {
  action: FlagAction;
  slug: string;
  productName: string;
  field: "is_visible" | "is_featured";
  value: boolean;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(value)} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-2 py-1 text-sm hover:border-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : label}
        <span className="sr-only">: {productName}</span>
      </button>
      {state ? (
        <span role="status" className={state.ok ? "text-xs" : "text-xs text-red-700"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
