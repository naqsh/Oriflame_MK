import type { CategoryOption } from "@/components/filters/filter-panel";
import type { CategoryNode } from "@/lib/api/schemas/catalogue";

/** Depth-first options for a category <select>; subcategories are indented with "— ". */
export function categoryOptions(nodes: CategoryNode[], depth = 0): CategoryOption[] {
  return nodes.flatMap((node) => [
    { slug: node.slug, label: `${"— ".repeat(depth)}${node.name}` },
    ...categoryOptions(node.children, depth + 1),
  ]);
}
