import Link from "next/link";

import { AvailabilityBadge } from "@/components/product/availability-badge";
import { Price } from "@/components/product/price";
import { ProductImage } from "@/components/product/product-image";
import { AddToListButton } from "@/components/referral/add-to-list-button";
import type { ProductSummary } from "@/lib/api/schemas/catalogue";

/**
 * Listing tile. The link wraps only the title, so its accessible name is exactly the
 * visible product name (WCAG 2.5.3); its ::after overlay keeps the whole tile clickable.
 * "Add to list" sits below the tile, since a button cannot sit inside a link.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="flex h-full flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-2 rounded-lg border p-3 hover:border-foreground has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2">
        <ProductImage image={product.primary_image} productName={product.name} />
        <h3 className="line-clamp-2 font-medium" title={product.name}>
          <Link
            href={`/products/${product.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {product.name}
          </Link>
        </h3>
        <Price value={product.price_pkr} />
        <div className="mt-auto">
          <AvailabilityBadge availability={product.availability} />
        </div>
      </div>
      <AddToListButton
        product={{ slug: product.slug, name: product.name, price_pkr: product.price_pkr }}
      />
    </article>
  );
}
