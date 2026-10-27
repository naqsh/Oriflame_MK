import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DevDataBanner } from "@/components/layout/dev-data-banner";
import { AvailabilityBadge } from "@/components/product/availability-badge";
import { Price } from "@/components/product/price";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductImage } from "@/components/product/product-image";
import { AddToListButton } from "@/components/referral/add-to-list-button";
import { BuyFromOriflame } from "@/components/referral/buy-from-oriflame";
import { getProduct } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import type { ProductDetail } from "@/lib/api/schemas/catalogue";
import { toParagraphs } from "@/lib/text";

export const PRODUCT_UNAVAILABLE =
  "This product is temporarily unavailable. Please try again shortly.";
export const CHECKOUT_NOTE = "Checkout and fulfilment happen on Oriflame's official platform.";

/** Pakistan date, e.g. "26-Oct-2026". */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(
    new Date(iso),
  );
}

function sourceHost(url: string): string {
  return new URL(url).hostname;
}

function Gallery({ product }: { product: ProductDetail }) {
  const [first, ...rest] = product.images;
  return (
    <div className="space-y-3">
      <ProductImage image={first ?? null} productName={product.name} />
      {rest.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2">
          {rest.map((image) => (
            <li key={image.url}>
              <ProductImage image={image} productName={product.name} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Body of /products/[slug]. Shows only sourced data: sections without data are left
 * out entirely, and nothing (claims, ingredients, variants) is added beyond the source.
 * Unknown or hidden slugs call notFound() (see frontend/AGENT.md, "Not found status").
 */
export async function ProductDetailContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: ProductDetail | null;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`product_page_failed kind=${error.kind} status=${error.status ?? "-"}`);
    return (
      <p role="status" className="rounded-md border px-4 py-3 text-muted-foreground">
        {PRODUCT_UNAVAILABLE}
      </p>
    );
  }
  if (product === null) notFound();

  const paragraphs = toParagraphs(product.description);
  const [primaryCategory] = product.categories;

  return (
    <article className="space-y-10">
      <DevDataBanner items={[product, ...product.related]} />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          ...(primaryCategory
            ? [{ name: primaryCategory.name, href: `/categories/${primaryCategory.slug}` }]
            : [{ name: "All products", href: "/products" }]),
          { name: product.name, href: `/products/${product.slug}` },
        ]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <Gallery product={product} />
        <div className="space-y-4">
          <h1 className="font-heading text-3xl font-semibold">{product.name}</h1>
          {product.sku ? (
            <p className="text-sm text-muted-foreground">Product code: {product.sku}</p>
          ) : null}
          <Price value={product.price_pkr} className="block text-2xl" />
          <AvailabilityBadge availability={product.availability} />
          <div data-slot="referral-handoff">
            <BuyFromOriflame origin="pdp" productSlug={product.slug} />
          </div>
          <div data-slot="add-to-list">
            <AddToListButton
              product={{ slug: product.slug, name: product.name, price_pkr: product.price_pkr }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{CHECKOUT_NOTE}</p>
          {product.is_development_data ? (
            <p className="text-sm text-muted-foreground">
              Development data: there is no official product page for this item.
            </p>
          ) : (
            <p className="text-sm">
              <a
                href={product.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View this product on {sourceHost(product.source_url)}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Details last updated from the source on{" "}
            <time dateTime={product.last_synced_at}>{formatDate(product.last_synced_at)}</time>.
          </p>
        </div>
      </div>
      {paragraphs.length > 0 ? (
        <section aria-labelledby="product-description" className="space-y-3">
          <h2 id="product-description" className="font-heading text-xl font-semibold">
            Description
          </h2>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="max-w-3xl">
              {paragraph}
            </p>
          ))}
        </section>
      ) : null}
      {product.related.length > 0 ? (
        <section aria-labelledby="related-products" className="space-y-4">
          <h2 id="related-products" className="font-heading text-xl font-semibold">
            Related products
          </h2>
          <ProductGrid products={product.related} />
        </section>
      ) : null}
    </article>
  );
}
