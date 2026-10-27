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
