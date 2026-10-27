"use client";

import { useActionState, useState } from "react";

import type { SyncActionState } from "@/lib/admin/constants";

type SyncAction = () => Promise<SyncActionState>;

/** "Run sync now" with an explicit confirmation step before the Server Action runs. */
export function RunSyncButton({ action }: { action: SyncAction }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<SyncActionState | null>(async () => {
    setConfirming(false);
    return action();
  }, null);

  return (
    <div className="space-y-2">
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <p id="sync-confirm">Start a catalogue sync now?</p>
          <button
            type="submit"
            aria-describedby="sync-confirm"
            className="rounded-md bg-foreground px-3 py-1 text-background"
          >
            Yes, start sync
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border px-3 py-1"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="rounded-md border px-3 py-1 disabled:opacity-60"
        >
          {pending ? "Starting…" : "Run sync now"}
        </button>
      )}
      {state ? (
        <p role="status" className={state.ok ? "text-sm" : "text-sm text-red-700"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
