import Link from "next/link";

import { type ListingParams, listingHref } from "@/lib/listing";

/** Previous / next links with rel attributes and the current position. */
export function Pagination({
  basePath,
  params,
  total,
  pageSize,
}: {
  basePath: string;
  params: ListingParams;
  total: number;
  pageSize: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1 && params.page <= 1) return null;
  const href = (page: number) => listingHref(basePath, { ...params, page });
  const linkClass = "rounded-md border px-3 py-1.5 text-sm hover:border-foreground";
  const disabledClass = "rounded-md border px-3 py-1.5 text-sm text-muted-foreground opacity-50";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {params.page > 1 ? (
        <Link href={href(Math.min(params.page - 1, pageCount))} rel="prev" className={linkClass}>
          Previous page
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous page
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {params.page} of {pageCount}
      </p>
      {params.page < pageCount ? (
        <Link href={href(params.page + 1)} rel="next" className={linkClass}>
          Next page
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next page
        </span>
      )}
    </nav>
  );
}
