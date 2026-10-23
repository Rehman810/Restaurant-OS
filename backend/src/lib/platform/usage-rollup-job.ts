import { Prisma, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { unscopedQueryRaw } from "../tenant-sql";
import { addKarachiDays, karachiDateOnly } from "./karachi-time";
import { markJobFinished, markJobStarted } from "./job-runs";
import { rollupTenantUsageForDay } from "./usage-rollup";

const JOB_KEY = "tenant_usage_rollup";
const BACKFILL_DAYS = Number(process.env.USAGE_ROLLUP_BACKFILL_DAYS || 90);

async function withLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const rows = await unscopedQueryRaw<Array<{ locked: boolean }>>(
    "usage rollup job lock",
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext('tenant_usage_rollup')) AS locked`
  );
  if (!rows[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await unscopedQueryRaw("usage rollup job unlock", Prisma.sql`SELECT pg_advisory_unlock(hashtext('tenant_usage_rollup'))`);
  }
}

export async function runTenantUsageRollupJob(now = new Date(), triggeredBy = "scheduler") {
  const historyId = await markJobStarted(JOB_KEY, triggeredBy);
  try {
    const result = await withLock(async () => {
      const tenants = await withoutTenant("usage rollup list tenants", () =>
        basePrisma.restaurant.findMany({
          where: { status: { not: TenantStatus.ARCHIVED } },
          select: { id: true },
        })
      );
      const daySpan = process.env.USAGE_ROLLUP_FULL === "1" ? BACKFILL_DAYS : 2;
      let rows = 0;
      for (let d = 0; d < daySpan; d++) {
        const ref = addKarachiDays(now, -d);
        for (const tenant of tenants) {
          await rollupTenantUsageForDay(tenant.id, ref);
          rows++;
        }
      }
      return { tenants: tenants.length, daysProcessed: daySpan, rowsUpserted: rows };
    });
    await markJobFinished(JOB_KEY, result ? null : "Could not acquire advisory lock.", historyId);
    return result ?? { skipped: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFinished(JOB_KEY, message, historyId);
    throw err;
  }
}
