import Link from "next/link";
import { Suspense } from "react";

import { CategoryNav } from "@/components/layout/category-nav";
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
          <div className="w-full sm:w-80">
            <SearchBox />
          </div>
        </div>
        <Suspense fallback={null}>
          <CategoryNav />
        </Suspense>
      </div>
    </header>
  );
}
