import type { Metadata } from "next";

import { getCategory, getProduct } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import { authorisedImageSrc } from "@/lib/images";
import { buildMetadata, describe } from "@/lib/seo/metadata";

const NOT_FOUND: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** Metadata if the API is down: never fails the page, never invents details. */
function unavailable(title: string, path: string): Metadata {
  return buildMetadata({
    title,
    description: "Browse Oriflame Pakistan products on this independent store.",
    path,
  });
}

/** Product page metadata. Development fixture products are noindex. */
export async function productMetadata(slug: string): Promise<Metadata> {
  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return unavailable("Product", `/products/${slug}`);
  }
  if (product === null) return NOT_FOUND;
  const category = product.categories[0]?.name;
  const fallback = `${product.name}${category ? ` in ${category}` : ""}: product details on this independent store. Buy it on Oriflame's official Pakistan website.`;
  const image = product.images[0] ? authorisedImageSrc(product.images[0].url) : null;
  return buildMetadata({
    title: product.name,
    description: describe(product.description, fallback),
    path: `/products/${product.slug}`,
    ...(image ? { image } : {}),
    noindex: product.is_development_data,
  });
}

/** Category page metadata. */
export async function categoryMetadata(slug: string): Promise<Metadata> {
  let category;
  try {
    category = await getCategory(slug);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return unavailable("Category", `/categories/${slug}`);
  }
  if (category === null) return NOT_FOUND;
  const count = category.product_count;
  return buildMetadata({
    title: category.name,
    description: `Browse ${count} ${category.name} ${count === 1 ? "product" : "products"} from Oriflame Pakistan on this independent store, with prices in PKR where available.`,
    path: `/categories/${category.slug}`,
  });
}
