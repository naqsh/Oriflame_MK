"use client";

import { useId, useRef, useState } from "react";

/**
 * Copy text to the clipboard. If the browser refuses (no permission, insecure
 * context), the text is shown selected with a "press Ctrl+C" hint instead.
 */
export function CopyText({
  text,
  label,
  copiedMessage,
  multiline = false,
}: {
  text: string;
  label: string;
  copiedMessage: string;
  multiline?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const fieldId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("manual");
      // Let the field render, then select it for Ctrl+C.
      requestAnimationFrame(() => fieldRef.current?.select());
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:border-foreground"
      >
        {label}
      </button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {state === "copied" ? copiedMessage : ""}
      </p>
      {state === "manual" ? (
        <div className="space-y-1">
          <label htmlFor={fieldId} className="text-sm">
            Copying is blocked in this browser. Press Ctrl+C (or ⌘C) to copy:
          </label>
          {multiline ? (
            <textarea
              id={fieldId}
              ref={fieldRef}
              readOnly
              value={text}
              rows={Math.min(8, text.split("\n").length)}
              className="w-full rounded-md border px-2 py-1 font-mono text-sm"
            />
          ) : (
            <input
              id={fieldId}
              ref={fieldRef}
              readOnly
              value={text}
              className="w-full rounded-md border px-2 py-1 font-mono text-sm"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The consultant code, from a manual_code handoff only. */
export function CopyReferralCode({ code }: { code: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Code: <strong className="font-mono text-base">{code}</strong>
      </p>
      <CopyText text={code} label="Copy code" copiedMessage="Code copied." />
    </div>
  );
}
