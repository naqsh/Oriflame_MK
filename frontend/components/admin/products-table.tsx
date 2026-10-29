import Link from "next/link";

import { updateProductFlagAction } from "@/app/admin/products/actions";
import { ProductFlagButton } from "@/components/admin/product-flag-button";
import { formatPrice } from "@/components/product/price";
import { formatDateTime } from "@/lib/admin/format";
import type { AdminProduct, AdminProductsPage } from "@/lib/admin/schemas";

/** Where the product stands for visitors, in plain words. */
export function storefrontStatus(product: AdminProduct): string {
  if (!product.listed_by_source) return "Not listed by the source";
  if (!product.is_visible) return "Hidden by you";
  return product.is_featured ? "Featured" : "Shown";
}

function pageHref(page: number, q: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return `/admin/products${text ? `?${text}` : ""}`;
}

export function ProductsTable({ data, q }: { data: AdminProductsPage; q: string }) {
  if (data.items.length === 0) {
    return <p>{q ? `No products match “${q}”.` : "No products yet. Run a catalogue sync first."}</p>;
  }
  const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Products, by name</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 pr-4">Product</th>
              <th scope="col" className="py-2 pr-4">Price</th>
              <th scope="col" className="py-2 pr-4">Storefront</th>
              <th scope="col" className="py-2 pr-4">Last synced (PKT)</th>
              <th scope="col" className="py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((product) => (
              <tr key={product.slug} className="border-b align-top">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {product.on_storefront ? (
                    <Link href={`/products/${product.slug}`} className="underline">
                      {product.name}
                    </Link>
                  ) : (
                    product.name
                  )}
                  <span className="block font-mono text-xs text-muted-foreground">
                    {product.sku ?? product.slug}
                  </span>
                </th>
                <td className="py-2 pr-4 whitespace-nowrap">{formatPrice(product.price_pkr)}</td>
                <td className="py-2 pr-4">{storefrontStatus(product)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  <time dateTime={product.last_synced_at}>{formatDateTime(product.last_synced_at)}</time>
                </td>
                <td className="flex flex-wrap gap-2 py-2">
                  <ProductFlagButton
                    action={updateProductFlagAction}
                    slug={product.slug}
                    productName={product.name}
                    field="is_visible"
                    value={!product.is_visible}
                    label={product.is_visible ? "Hide" : "Show"}
                  />
                  {product.is_visible && product.listed_by_source ? (
                    <ProductFlagButton
                      action={updateProductFlagAction}
                      slug={product.slug}
                      productName={product.name}
                      field="is_featured"
                      value={!product.is_featured}
                      label={product.is_featured ? "Unfeature" : "Feature"}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Product pages" className="flex items-center gap-4 text-sm">
        {data.page > 1 ? (
          <Link href={pageHref(data.page - 1, q)} className="underline">
            Previous
          </Link>
        ) : null}
        <span>
          Page {data.page} of {lastPage} ({data.total} products)
        </span>
        {data.page < lastPage ? (
          <Link href={pageHref(data.page + 1, q)} className="underline">
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
