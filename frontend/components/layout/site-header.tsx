import Link from "next/link";

import { SITE_NAME } from "@/lib/seo/site";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-4">
        <Link href="/" className="font-heading text-lg font-semibold">
          {SITE_NAME}
        </Link>
      </div>
    </header>
  );
}
