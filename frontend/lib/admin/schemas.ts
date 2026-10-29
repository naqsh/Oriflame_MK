import { z } from "zod";

/** Admin API responses (OR-E6). Only the server reads these; tokens never reach the browser. */
export const loginResponseSchema = z.object({
  token: z.string().min(20),
  expires_at: z.iso.datetime({ offset: true }),
});

export const setupStatusSchema = z.object({ has_admin: z.boolean() });

export const adminMeSchema = z.object({
  email: z.string(),
  last_login_at: z.iso.datetime({ offset: true }).nullable(),
});
export type AdminMe = z.infer<typeof adminMeSchema>;

/** The login form, validated in the Server Action before anything is sent. */
export const loginFormSchema = z.object({
  email: z.string().trim().min(3, "Enter your email address.").max(254).pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(1024),
});

export const auditPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      occurred_at: z.iso.datetime({ offset: true }),
      admin_user_id: z.number().nullable(),
      action: z.string(),
      target_type: z.string().nullable(),
      target_id: z.string().nullable(),
      details: z.record(z.string(), z.unknown()),
    }),
  ),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;

export const syncRunsSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      source: z.string(),
      status: z.enum(["running", "success", "failed", "partial"]),
      started_at: z.iso.datetime({ offset: true }),
      finished_at: z.iso.datetime({ offset: true }).nullable(),
      created_count: z.number(),
      updated_count: z.number(),
      unchanged_count: z.number(),
      error_count: z.number(),
      error_detail: z.string().nullable(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  last_success_at: z.iso.datetime({ offset: true }).nullable(),
});
export type SyncRuns = z.infer<typeof syncRunsSchema>;

export const referralSetupSchema = z.object({
  method: z.string(),
  status: z.enum(["configured", "not_configured", "invalid"]),
  referral_host: z.string().nullable(),
  masked_code: z.string().nullable(),
  managed_by: z.string(),
});
export type ReferralSetup = z.infer<typeof referralSetupSchema>;

export const referralClicksSchema = z.object({
  start: z.iso.date(),
  end: z.iso.date(),
  total: z.number(),
  by_origin: z.record(z.string(), z.number()),
  days: z.array(z.object({ day: z.iso.date(), total: z.number(), by_method: z.record(z.string(), z.number()) })),
});
export type ReferralClicks = z.infer<typeof referralClicksSchema>;

/** One row of the admin product table (OR-048). Product facts are read-only here. */
export const adminProductSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  source: z.string(),
  price_pkr: z.string().nullable(),
  last_synced_at: z.iso.datetime({ offset: true }),
  is_visible: z.boolean(),
  is_featured: z.boolean(),
  listed_by_source: z.boolean(),
  on_storefront: z.boolean(),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;

export const adminProductsPageSchema = z.object({
  items: z.array(adminProductSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});
export type AdminProductsPage = z.infer<typeof adminProductsPageSchema>;

export const productFlagsUpdatedSchema = z.object({
  product: adminProductSchema,
  message: z.string(),
});

/** A flag toggle submitted from the product table. */
export const productFlagFormSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  field: z.enum(["is_visible", "is_featured"]),
  value: z.enum(["true", "false"]).transform((value) => value === "true"),
});
