import { TenantStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { basePrisma } from "./prisma-base";
import { runWithRestaurant, withoutTenant } from "./restaurant-context";
import { unscopedQueryRaw } from "./tenant-sql";

const JOB_STATUSES: TenantStatus[] = [
  TenantStatus.ACTIVE,
  TenantStatus.TRIAL,
  TenantStatus.PAST_DUE,
];

/** Run work for each tenant that should receive background jobs. Uses a per-tenant advisory try-lock. */
export async function forEachJobTenant(reason: string, fn: (restaurantId: string) => Promise<void>) {
  const tenants = await withoutTenant(reason, () =>
    basePrisma.restaurant.findMany({
      where: { status: { in: JOB_STATUSES } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
  );
  for (const tenant of tenants) {
    await runWithRestaurant(tenant.id, async () => {
      const locked = await tryTenantAdvisoryLock(tenant.id);
      if (!locked) return;
      try {
        await fn(tenant.id);
      } finally {
        await releaseTenantAdvisoryLock(tenant.id);
      }
    });
  }
}

async function tryTenantAdvisoryLock(restaurantId: string): Promise<boolean> {
  const rows = await unscopedQueryRaw<Array<{ locked: boolean }>>(
    "tenant job advisory lock",
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext(${restaurantId})) AS locked`
  );
  return Boolean(rows[0]?.locked);
}

async function releaseTenantAdvisoryLock(restaurantId: string) {
  await unscopedQueryRaw(
    "tenant job advisory unlock",
    Prisma.sql`SELECT pg_advisory_unlock(hashtext(${restaurantId}))`
  );
}
