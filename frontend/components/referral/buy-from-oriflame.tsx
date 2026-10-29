"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CopyReferralCode, CopyText } from "@/components/referral/copy-text";
import { type Handoff, type HandoffOrigin, requestHandoff } from "@/lib/api/referral";

export interface HandoffItem {
  name: string;
  quantity: number;
}

export const HANDOFF_ERROR = "We couldn't reach the store just now. Please try again.";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "dialog"; handoff: Handoff };

function destination(handoff: Handoff): string {
  switch (handoff.method) {
    case "official_url":
      return handoff.url;
    case "manual_code":
      return handoff.checkout_url;
    case "unavailable":
      return handoff.fallback_url;
  }
}

function listText(items: HandoffItem[]): string {
  return items.map((item) => `${item.quantity} x ${item.name}`).join("\n");
}

/**
 * "Buy from Oriflame" (OR-033). Asks the server for the handoff on click; the URL and
 * code only ever come from that response, never from the client. Checkout and payment
 * always happen on Oriflame (docs/REFERRAL.md, "Checkout handoff").
 */
export function BuyFromOriflame({
  origin,
  productSlug,
  items = [],
  label = "Buy from Oriflame",
}: {
  origin: HandoffOrigin;
  productSlug?: string;
  items?: HandoffItem[];
  label?: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = state.kind === "dialog";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal(); // modal: focus stays inside
  }, [open]);

  async function start() {
    setState({ kind: "loading" });
    let handoff: Handoff;
    try {
      handoff = await requestHandoff({
        origin,
        productSlug,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      });
    } catch {
      setState({ kind: "error" });
      return;
    }
    if (handoff.method === "official_url" && items.length === 0) {
      const opened = window.open(handoff.url, "_blank");
      if (opened) {
        opened.opener = null; // same protection as rel="noopener"
        setState({ kind: "idle" });
        return;
      }
      // Pop-up blocked: fall through to the dialog's same-tab link.
    }
    setState({ kind: "dialog", handoff });
  }

  function close() {
    dialogRef.current?.close();
    setState({ kind: "idle" });
  }

  const handoff = state.kind === "dialog" ? state.handoff : null;
  const popupBlocked = handoff?.method === "official_url" && items.length === 0;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={state.kind === "loading"}
        className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
      >
        {state.kind === "loading" ? "Opening Oriflame…" : label}
      </button>

      {state.kind === "error" ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{HANDOFF_ERROR}</p>
          <button type="button" onClick={() => void start()} className="underline">
            Try again
          </button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        onClose={() => setState({ kind: "idle" })}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="buy-dialog m-auto w-full max-w-lg rounded-lg border bg-background p-6 text-foreground backdrop:bg-black/40"
      >
        {handoff ? (
          <div className="space-y-4">
            <h2 id={titleId} className="font-heading text-xl font-semibold">
              Continue on Oriflame
            </h2>

            {handoff.method === "official_url" ? <p>{handoff.note}</p> : null}
            {handoff.method === "unavailable" ? <p>{handoff.message}</p> : null}
            {handoff.method === "manual_code" ? (
              <>
                <ol className="list-decimal space-y-1 pl-5">
                  {handoff.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <CopyReferralCode code={handoff.code} />
              </>
            ) : null}

            {items.length > 0 ? (
              <section aria-labelledby={`${titleId}-items`} className="space-y-2">
                <h3 id={`${titleId}-items`} className="font-medium">
                  Items to add on Oriflame
                </h3>
                <ul className="list-disc pl-5 text-sm">
                  {items.map((item) => (
                    <li key={item.name}>
                      {item.quantity} × {item.name}
                    </li>
                  ))}
                </ul>
                <CopyText
                  text={listText(items)}
                  label="Copy list"
                  copiedMessage="List copied."
                  multiline
                />
              </section>
            ) : null}

            {popupBlocked ? (
              <p className="text-sm text-muted-foreground">
                Your browser blocked the new tab. Use the link below instead.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={destination(handoff)}
                target={popupBlocked ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="rounded-md bg-foreground px-4 py-2 font-medium text-background"
              >
                Continue to Oriflame
              </a>
              <button type="button" onClick={close} className="text-sm underline">
                Close
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
