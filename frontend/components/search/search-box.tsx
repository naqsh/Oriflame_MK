/** Plain GET form to /search: works without JavaScript, so it stays a Server Component. */
export function SearchBox() {
  return (
    <form action="/search" method="get" role="search" className="flex gap-2">
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        required
        maxLength={100}
        placeholder="Search products"
        className="w-full min-w-0 rounded-md border px-3 py-1.5 text-sm"
      />
      <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">
        Search
      </button>
    </form>
  );
}
