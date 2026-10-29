"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { CATALOGUE_CACHE_TAG, type ProductFlagState } from "@/lib/admin/constants";
import { productFlagFormSchema, productFlagsUpdatedSchema } from "@/lib/admin/schemas";
import { getAdminToken } from "@/lib/admin/session";
import { DEFAULT_TIMEOUT_MS, getApiBaseUrl } from "@/lib/api/client";

/**
 * Show, hide, feature or unfeature one product (OR-048). A Server Action, so Next.js
 * checks the Origin. On success the catalogue cache is expired, so the storefront shows
 * the change on the next request instead of within the cache lifetime.
 */
export async function updateProductFlagAction(
  _previous: ProductFlagState | null,
  form: FormData,
): Promise<ProductFlagState> {
  const parsed = productFlagFormSchema.safeParse({
    slug: form.get("slug"),
    field: form.get("field"),
    value: form.get("value"),
  });
  if (!parsed.success) return { ok: false, message: "That change could not be sent." };
  const { slug, field, value } = parsed.data;

  const token = await getAdminToken();
  if (!token) redirect("/admin/login?reason=signin");

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/v1/admin/products/${slug}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ [field]: value }),
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, message: "The API could not be reached. Try again shortly." };
  }
  if (response.status === 401) redirect("/admin/login?reason=expired");
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 409) {
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : null;
    return { ok: false, message: detail ?? "That change is not allowed." };
  }
  if (response.status === 404) return { ok: false, message: "That product no longer exists." };
  const updated = productFlagsUpdatedSchema.safeParse(body);
  if (!response.ok || !updated.success) return { ok: false, message: "The change could not be saved." };

  updateTag(CATALOGUE_CACHE_TAG);
  revalidatePath("/admin/products");
  return { ok: true, message: `${updated.data.product.name}: ${updated.data.message}` };
}
