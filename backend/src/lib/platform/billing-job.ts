import {
  PlanInterval,
  PlatformInvoiceStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { allocateCounter } from "../counters";
import { prisma } from "../prisma";
import { runWithRestaurant, withoutTenant } from "../restaurant-context";
import { unscopedQueryRaw } from "../tenant-sql";
import { markJobFinished, markJobStarted } from "./job-runs";

const JOB_KEY = "platform_billing";

const DUE_DAYS = Number(process.env.PLATFORM_INVOICE_DUE_DAYS || 7);

function addInterval(start: Date, interval: PlanInterval) {
  const end = new Date(start);
  if (interval === PlanInterval.YEARLY) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

async function withBillingLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const rows = await unscopedQueryRaw<Array<{ locked: boolean }>>(
    "platform billing job lock",
    Prisma.sql`SELECT pg_try_advisory_lock(hashtext('platform_billing_job')) AS locked`
  );
  if (!rows[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await unscopedQueryRaw("platform billing job unlock", Prisma.sql`SELECT pg_advisory_unlock(hashtext('platform_billing_job'))`);
  }
}

async function nextPlatformInvoiceNumber(restaurantId: string, periodKey: string) {
  return runWithRestaurant(restaurantId, async () => {
    const seq = await allocateCounter(prisma, { name: "platform_invoice", periodKey, branchId: "", floor: 0 });
    return `PINV-${periodKey}-${seq}`;
  });
}

async function createOpenInvoice(
  subscriptionId: string,
  restaurantId: string,
  amountPkr: number,
  periodStart: Date,
  periodEnd: Date
) {
  const periodKey = periodStart.toISOString().slice(0, 7).replace("-", "");
  const invoiceNumber = await nextPlatformInvoiceNumber(restaurantId, periodKey);
  const dueAt = new Date(periodEnd);
  dueAt.setUTCDate(dueAt.getUTCDate() + DUE_DAYS);
  return basePrisma.platformInvoice.create({
    data: {
      restaurantId,
      subscriptionId,
      invoiceNumber,
      status: PlatformInvoiceStatus.OPEN,
      amountPkr,
      periodStart,
      periodEnd,
      dueAt,
    },
  });
}

export async function runPlatformBillingJob(now = new Date()) {
  await markJobStarted(JOB_KEY);
  try {
    const out = await withoutTenant("platform billing job", async () => {
    const result = await withBillingLock(async () => {
      const subs = await basePrisma.subscription.findMany({
        where: { status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
        include: { plan: true },
      });
      let invoicesCreated = 0;
      let markedPastDue = 0;

      for (const sub of subs) {
        if (sub.status === SubscriptionStatus.TRIALING && sub.trialEndsAt && sub.trialEndsAt <= now) {
          const nextStatus = SubscriptionStatus.ACTIVE;
          const periodStart = now;
          const periodEnd = addInterval(periodStart, sub.plan.interval);
          await basePrisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: nextStatus,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
            },
          });
          if (sub.plan.pricePkr > 0) {
            await createOpenInvoice(sub.id, sub.restaurantId, sub.plan.pricePkr, periodStart, periodEnd);
            invoicesCreated += 1;
          }
          continue;
        }

        if (
          (sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.PAST_DUE) &&
          sub.currentPeriodEnd <= now
        ) {
          const periodStart = sub.currentPeriodEnd;
          const periodEnd = addInterval(periodStart, sub.plan.interval);
          await basePrisma.subscription.update({
            where: { id: sub.id },
            data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
          });
          if (sub.plan.pricePkr > 0) {
            await createOpenInvoice(sub.id, sub.restaurantId, sub.plan.pricePkr, periodStart, periodEnd);
            invoicesCreated += 1;
            if (sub.status === SubscriptionStatus.ACTIVE) {
              await basePrisma.subscription.update({
                where: { id: sub.id },
                data: { status: SubscriptionStatus.PAST_DUE },
              });
              await basePrisma.restaurant.update({
                where: { id: sub.restaurantId },
                data: { status: TenantStatus.PAST_DUE, statusReason: "Subscription payment due.", statusChangedAt: now },
              });
              markedPastDue += 1;
            }
          }
        }
      }

      const overdue = await basePrisma.platformInvoice.findMany({
        where: { status: PlatformInvoiceStatus.OPEN, dueAt: { lt: now } },
        select: { restaurantId: true, subscriptionId: true },
      });
      for (const row of overdue) {
        await basePrisma.subscription.updateMany({
          where: { id: row.subscriptionId, status: { not: SubscriptionStatus.CANCELLED } },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        await basePrisma.restaurant.updateMany({
          where: { id: row.restaurantId, status: TenantStatus.ACTIVE },
          data: { status: TenantStatus.PAST_DUE, statusReason: "Subscription payment overdue.", statusChangedAt: now },
        });
      }

      return { invoicesCreated, markedPastDue, overdueInvoices: overdue.length };
    });
    return result ?? { skipped: true as const };
  });
    await markJobFinished(JOB_KEY, null);
    return out;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFinished(JOB_KEY, message);
    throw err;
  }
}
