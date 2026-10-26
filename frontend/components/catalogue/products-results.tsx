import { ProductListing } from "@/components/filters/product-listing";
import { getCategories } from "@/lib/api/catalogue";
import { ApiError } from "@/lib/api/client";
import { categoryOptions } from "@/lib/categories";
import { type RawSearchParams, parseListingParams } from "@/lib/listing";

export const PRODUCTS_PATH = "/products";

/** Body of /products: reads the URL state, so it renders per request inside Suspense. */
export async function ProductsResults({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = parseListingParams(await searchParams);
  let options;
  try {
    options = categoryOptions((await getCategories()).items);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // Without categories the page still lists products; only the category filter is lost.
    console.error(`category_options_failed kind=${error.kind} status=${error.status ?? "-"}`);
  }
  return <ProductListing basePath={PRODUCTS_PATH} params={params} categories={options} />;
}
