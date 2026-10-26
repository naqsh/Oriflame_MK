import { ProductCard } from "@/components/product/product-card";
import type { ProductSummary } from "@/lib/api/schemas/catalogue";

export function ProductGrid({
  products,
  emptyMessage = "No products found.",
}: {
  products: ProductSummary[];
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
