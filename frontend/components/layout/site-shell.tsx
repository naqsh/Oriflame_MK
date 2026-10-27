import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Page landmarks shared by every route: banner, main and contentinfo. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* min-h-svh keeps the footer below the fold while streamed content arrives (CLS). */}
      <main className="mx-auto min-h-svh w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}
