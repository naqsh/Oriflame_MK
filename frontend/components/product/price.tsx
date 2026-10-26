import { cn } from "@/lib/utils/cn";

export const PRICE_NOT_AVAILABLE = "Price not available";

/**
 * "Rs 1,499" for whole rupees, "Rs 999.50" when there are paisa, or
 * "Price not available" when the source gave no price (never 0 or a guess).
 */
export function formatPrice(value: string | null): string {
  if (value === null) return PRICE_NOT_AVAILABLE;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return PRICE_NOT_AVAILABLE;
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function Price({ value, className }: { value: string | null; className?: string }) {
  return (
    <span className={cn(value === null ? "text-muted-foreground" : "font-medium", className)}>
      {formatPrice(value)}
    </span>
  );
}
