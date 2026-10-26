/** Placeholder with the product grid's footprint, so layout does not jump when data arrives. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
