import Link from "next/link";
import { Suspense } from "react";

import { CategoryNav } from "@/components/layout/category-nav";
import { ListIndicator } from "@/components/referral/list-indicator";
import { SearchBox } from "@/components/search/search-box";
import { SITE_NAME } from "@/lib/seo/site";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-heading text-lg font-semibold">
            {SITE_NAME}
          </Link>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-80">
              <SearchBox />
            </div>
            <ListIndicator />
          </div>
        </div>
        {/* Reserve the nav's line while it streams in, so the page below does not jump. */}
        <div className="min-h-5">
          <Suspense fallback={null}>
            <CategoryNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
