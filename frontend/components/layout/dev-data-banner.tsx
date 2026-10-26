export const DEV_FIXTURE_SOURCE = "dev_fixture";

interface SourcedItem {
  data_source: string;
  is_development_data?: boolean;
}

/** Shown only when at least one rendered item is development fixture data. */
export function DevDataBanner({ items }: { items: SourcedItem[] }) {
  const hasFixtures = items.some(
    (item) => item.is_development_data === true || item.data_source === DEV_FIXTURE_SOURCE,
  );
  if (!hasFixtures) return null;
  return (
    <aside
      aria-label="Development data notice"
      className="mb-6 rounded-md border border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <strong>Development data.</strong> These are placeholder products for testing, not live
      Oriflame products, prices or availability.
    </aside>
  );
}
