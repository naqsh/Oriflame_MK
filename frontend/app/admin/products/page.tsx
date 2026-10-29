import { connection } from "next/server";
import { Suspense } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { ProductsTable } from "@/components/admin/products-table";
import { adminRequest } from "@/lib/admin/api";
import { pageParam, queryParam } from "@/lib/admin/format";
import { adminProductsPageSchema } from "@/lib/admin/schemas";

const PAGE_SIZE = 25;

async function ProductsContent({ searchParams }: PageProps<"/admin/products">) {
  await connection();
  const params = await searchParams;
  const q = queryParam(params.q);
  const page = pageParam(params.page);
  const query = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (q) query.set("q", q);
  const data = await adminRequest(`/products?${query}`, adminProductsPageSchema);
  return (
    <>
      <form role="search" action="/admin/products" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Search by name, SKU or slug
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={100}
            className="rounded-md border px-3 py-1.5"
          />
        </label>
        <button type="submit" className="rounded-md border px-3 py-1.5 text-sm">
          Search
        </button>
      </form>
      <ProductsTable data={data} q={q} />
    </>
  );
}

export default function AdminProductsPage(props: PageProps<"/admin/products">) {
  return (
    <section className="space-y-6">
      <AdminHeader title="Products" />
      <p className="max-w-prose text-sm text-muted-foreground">
        Hide a product or feature it on the homepage. Names, prices and availability come
        from the catalogue source and cannot be edited here. A sync never changes these
        choices; a product the source stops listing disappears until it is listed again.
      </p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ProductsContent {...props} />
      </Suspense>
    </section>
  );
}
