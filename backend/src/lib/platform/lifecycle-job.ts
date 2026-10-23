import { Prisma, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { unscopedQueryRaw } from "../tenant-sql";
import { invalidateTenantHostCache } from "../tenant-resolve";
import { markJobFinished, markJobStarted } from "./job-runs";

const JOB_KEY = "tenant_lifecycle";

async function withLifecycleLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const rows = await unscopedQueryRaw<Array<{ locked: boolean }>>(
    "tenant lifecycle job lock",
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext('tenant_lifecycle_job')) AS locked`
  );
  if (!rows[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await unscopedQueryRaw("tenant lifecycle job unlock", Prisma.sql`SELECT pg_advisory_unlock(hashtext('tenant_lifecycle_job'))`);
  }
}

/** Moves cancelled tenants to archived after the retention window. Data purge is a later operations task. */
export async function runTenantLifecycleJob(now = new Date(), triggeredBy = "scheduler") {
  const historyId = await markJobStarted(JOB_KEY, triggeredBy);
  try {
    const out = await withoutTenant("tenant lifecycle job", async () => {
    const result = await withLifecycleLock(async () => {
      const due = await basePrisma.restaurant.findMany({
        where: {
          status: TenantStatus.CANCELLED,
          deleteScheduledAt: { lte: now },
        },
        select: { id: true, slug: true, hostname: true },
      });
      for (const row of due) {
        await basePrisma.restaurant.update({
          where: { id: row.id },
          data: {
            status: TenantStatus.ARCHIVED,
            archivedAt: now,
            statusChangedAt: now,
            statusReason: "Retention period ended.",
            hostname: null,
          },
        });
        invalidateTenantHostCache(row.hostname || undefined);
        invalidateTenantHostCache(row.slug);
      }
      return { archived: due.length };
    });
    return result ?? { skipped: true as const };
  });
    await markJobFinished(JOB_KEY, null, historyId);
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFinished(JOB_KEY, message, historyId);
    throw err;
  }
}
