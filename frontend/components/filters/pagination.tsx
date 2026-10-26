import Link from "next/link";

/** Previous / next links with rel attributes and the current position. */
export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  /** URL for a page number, keeping the rest of the page's state. */
  hrefFor: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1 && page <= 1) return null;
  const linkClass = "rounded-md border px-3 py-1.5 text-sm hover:border-foreground";
  const disabledClass = "rounded-md border px-3 py-1.5 text-sm text-muted-foreground opacity-50";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(Math.min(page - 1, pageCount))} rel="prev" className={linkClass}>
          Previous page
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous page
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
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
