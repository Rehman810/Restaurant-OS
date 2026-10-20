import type { Category, MenuItem } from "@prisma/client";

export function categoryOrderMap(categories: Pick<Category, "name" | "sortOrder">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of categories) map.set(c.name, c.sortOrder);
  return map;
}

export function compareMenuItems(
  a: Pick<MenuItem, "category" | "sortOrder" | "name">,
  b: Pick<MenuItem, "category" | "sortOrder" | "name">,
  catOrder: Map<string, number>
): number {
  const ca = catOrder.get(a.category) ?? 9999;
  const cb = catOrder.get(b.category) ?? 9999;
  if (ca !== cb) return ca - cb;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}
