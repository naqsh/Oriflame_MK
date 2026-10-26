import Link from "next/link";

import { AvailabilityBadge } from "@/components/product/availability-badge";
import { Price } from "@/components/product/price";
import { ProductImage } from "@/components/product/product-image";
import { AddToListButton } from "@/components/referral/add-to-list-button";
import type { ProductSummary } from "@/lib/api/schemas/catalogue";

/**
 * Listing tile: one link to the product page (long names clamped visually only), with
 * "Add to list" below it, since a button cannot sit inside a link.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="flex h-full flex-col gap-2">
      <Link
        href={`/products/${product.slug}`}
        aria-label={product.name}
        className="flex flex-1 flex-col gap-2 rounded-lg border p-3 hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ProductImage image={product.primary_image} productName={product.name} />
        <h3 className="line-clamp-2 font-medium" title={product.name}>
          {product.name}
        </h3>
        <Price value={product.price_pkr} />
        <div className="mt-auto">
          <AvailabilityBadge availability={product.availability} />
        </div>
      </Link>
      <AddToListButton
        product={{ slug: product.slug, name: product.name, price_pkr: product.price_pkr }}
      />
    </article>
  );
}
