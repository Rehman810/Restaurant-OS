import type { Prisma } from "@prisma/client";

/** Production KPIs and health metrics exclude demo/test tenants. */
export const REAL_TENANT_FILTER: Prisma.RestaurantWhereInput = { isTest: false };

export function restaurantIdsExcludingTest(ids: string[], testIds: Set<string>) {
  return ids.filter((id) => !testIds.has(id));
}
