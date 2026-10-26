import { z } from "zod";

/**
 * Catalogue API schemas. They mirror backend/app/schemas/products.py and
 * backend/app/schemas/categories.py; extra fields are stripped, missing or wrong
 * fields make fetchJson throw ApiError("invalid_response").
 */

/** URL-safe slug, same rule as the backend (SLUG_PATTERN). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Decimal string such as "1499.00"; null means the source gave no price. */
const priceSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/)
  .nullable();

export const availabilitySchema = z.object({
  status: z.enum(["verified_in_stock", "verified_out_of_stock", "not_confirmed"]),
  label: z.string().min(1),
  checked_at: z.iso.datetime({ offset: true }).nullable(),
});

export const imageSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  alt_text: z.string(),
});

export const categoryRefSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().min(1),
});

export const productSummarySchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().min(1),
  price_pkr: priceSchema,
  currency: z.literal("PKR"),
  primary_image: imageSchema.nullable(),
  availability: availabilitySchema,
  data_source: z.string().min(1),
  is_development_data: z.boolean(),
});

export const productPageSchema = z.object({
  items: z.array(productSummarySchema),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  page_size: z.int().positive(),
});

/** Search returns the same shape as the product listing. */
export const searchResultSchema = productPageSchema;

export const productDetailSchema = productSummarySchema.extend({
  sku: z.string().nullable(),
  description: z.string().nullable(),
  images: z.array(imageSchema),
  categories: z.array(categoryRefSchema),
  source_url: z.url({ protocol: /^https?$/ }),
  last_synced_at: z.iso.datetime({ offset: true }),
  related: z.array(productSummarySchema),
});

export const categoryNodeSchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().min(1),
  product_count: z.int().nonnegative(),
  get children(): z.ZodArray<typeof categoryNodeSchema> {
    return z.array(categoryNodeSchema);
  },
});

export const categoryTreeSchema = z.object({
  items: z.array(categoryNodeSchema),
});

export const categorySummarySchema = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name: z.string().min(1),
  product_count: z.int().nonnegative(),
});

export const categoryDetailSchema = categorySummarySchema.extend({
  ancestors: z.array(categoryRefSchema),
  children: z.array(categorySummarySchema),
});

export type Availability = z.infer<typeof availabilitySchema>;
export type ProductImage = z.infer<typeof imageSchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type CategoryNode = z.infer<typeof categoryNodeSchema>;
export type CategoryTree = z.infer<typeof categoryTreeSchema>;
export type CategoryDetail = z.infer<typeof categoryDetailSchema>;
