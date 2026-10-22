import {
  PlanInterval,
  PlatformInvoiceStatus,
  Prisma,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { prisma } from "../prisma";
import { allocateCounter } from "../counters";
import { runWithRestaurant, withoutTenant } from "../restaurant-context";
import { unscopedQueryRaw } from "../tenant-sql";
import { notifyTenantBillingEvent } from "./subscription-notify";

const DUE_DAYS = Number(process.env.PLATFORM_INVOICE_DUE_DAYS || 7);
const SUSPEND_AFTER_DUE_DAYS = Math.max(1, Number(process.env.PLATFORM_SUSPEND_AFTER_DUE_DAYS || 14));

function addInterval(start: Date, interval: PlanInterval) {
  const end = new Date(start);
  if (interval === PlanInterval.YEARLY) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
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
  const existing = await basePrisma.platformInvoice.findFirst({
    where: {
      subscriptionId,
      periodStart,
      periodEnd,
      status: { in: [PlatformInvoiceStatus.OPEN, PlatformInvoiceStatus.PAID] },
    },
    select: { id: true },
  });
  if (existing) return null;
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

type SubRow = {
  id: string;
  restaurantId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: { interval: PlanInterval; pricePkr: number };
};

export async function processSubscriptionForRestaurant(sub: SubRow, now = new Date()) {
  let invoicesCreated = 0;
  let markedPastDue = 0;
  let suspended = 0;

  if (sub.status === SubscriptionStatus.TRIALING && sub.trialEndsAt && sub.trialEndsAt <= now) {
    const periodStart = now;
    const periodEnd = addInterval(periodStart, sub.plan.interval);
    await basePrisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });
    if (sub.plan.pricePkr > 0) {
      const inv = await createOpenInvoice(sub.id, sub.restaurantId, sub.plan.pricePkr, periodStart, periodEnd);
      if (inv) invoicesCreated += 1;
      await basePrisma.restaurant.updateMany({
        where: {
          id: sub.restaurantId,
          status: { in: [TenantStatus.TRIAL, TenantStatus.ACTIVE] },
        },
        data: {
          status: TenantStatus.PAST_DUE,
          statusReason: "Free trial ended. Pay your subscription invoice to restore full access.",
          statusChangedAt: now,
        },
      });
      markedPastDue += 1;
      void notifyTenantBillingEvent(sub.restaurantId, {
        title: "Free trial ended — payment required",
        message:
          "Your free trial has ended. Pay the open platform invoice to restore full access to POS, kitchen, and online ordering.",
        severity: "urgent",
      });
    } else {
      await basePrisma.restaurant.updateMany({
        where: { id: sub.restaurantId, status: TenantStatus.TRIAL },
        data: { status: TenantStatus.ACTIVE, statusReason: "", statusChangedAt: now },
      });
    }
    return { invoicesCreated, markedPastDue, suspended };
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
      const inv = await createOpenInvoice(sub.id, sub.restaurantId, sub.plan.pricePkr, periodStart, periodEnd);
      if (inv) invoicesCreated += 1;
      if (sub.status === SubscriptionStatus.ACTIVE) {
        await basePrisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        await basePrisma.restaurant.updateMany({
          where: { id: sub.restaurantId, status: TenantStatus.ACTIVE },
          data: {
            status: TenantStatus.PAST_DUE,
            statusReason: "Subscription payment due for the new billing period.",
            statusChangedAt: now,
          },
        });
        markedPastDue += 1;
        void notifyTenantBillingEvent(sub.restaurantId, {
          title: "Subscription payment due",
          message:
            "A new billing period has started. Pay the open invoice to keep full access to your restaurant admin.",
          severity: "warning",
        });
      }
    }
  }

  const overdue = await basePrisma.platformInvoice.findMany({
    where: { restaurantId: sub.restaurantId, status: PlatformInvoiceStatus.OPEN, dueAt: { lt: now } },
    select: { dueAt: true },
  });
  if (overdue.length > 0) {
    await basePrisma.subscription.updateMany({
      where: { id: sub.id, status: { not: SubscriptionStatus.CANCELLED } },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
    await basePrisma.restaurant.updateMany({
      where: { id: sub.restaurantId, status: TenantStatus.ACTIVE },
      data: {
        status: TenantStatus.PAST_DUE,
        statusReason: "Subscription payment overdue.",
        statusChangedAt: now,
      },
    });
    const oldestDue = overdue.reduce((min, row) => (row.dueAt < min ? row.dueAt : min), overdue[0]!.dueAt);
    const suspendAt = new Date(oldestDue);
    suspendAt.setUTCDate(suspendAt.getUTCDate() + SUSPEND_AFTER_DUE_DAYS);
    if (suspendAt <= now) {
      const updated = await basePrisma.restaurant.updateMany({
        where: { id: sub.restaurantId, status: TenantStatus.PAST_DUE },
        data: {
          status: TenantStatus.SUSPENDED,
          statusReason: "Subscription unpaid after grace period. Contact support to reactivate.",
          statusChangedAt: now,
        },
      });
      suspended += updated.count;
      if (updated.count > 0) {
        void notifyTenantBillingEvent(sub.restaurantId, {
          title: "Account suspended — unpaid subscription",
          message:
            "Your store was suspended after the payment grace period. Contact Restaurant OS support after paying your invoice.",
          severity: "urgent",
        });
      }
    }
  }

  return { invoicesCreated, markedPastDue, suspended };
}

export async function ensureSubscriptionSynced(restaurantId: string, now = new Date()) {
  return withoutTenant("subscription sync", async () => {
    const sub = await basePrisma.subscription.findUnique({
      where: { restaurantId },
      include: { plan: { select: { interval: true, pricePkr: true } } },
    });
    if (!sub) return null;
    if (
      sub.status === SubscriptionStatus.CANCELLED ||
      (sub.status !== SubscriptionStatus.TRIALING &&
        sub.status !== SubscriptionStatus.ACTIVE &&
        sub.status !== SubscriptionStatus.PAST_DUE)
    ) {
      return null;
    }
    const needsTick =
      (sub.status === SubscriptionStatus.TRIALING && sub.trialEndsAt && sub.trialEndsAt <= now) ||
      ((sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.PAST_DUE) &&
        sub.currentPeriodEnd <= now);
    const openOverdue = await basePrisma.platformInvoice.findFirst({
      where: { restaurantId, status: PlatformInvoiceStatus.OPEN, dueAt: { lt: now } },
      select: { id: true },
    });
    if (!needsTick && !openOverdue) return null;
    return processSubscriptionForRestaurant(sub, now);
  });
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
    await unscopedQueryRaw(
      "platform billing job unlock",
      Prisma.sql`SELECT pg_advisory_unlock(hashtext('platform_billing_job'))`
    );
  }
}

export async function runSubscriptionLifecycleBatch(now = new Date()) {
  return withoutTenant("subscription lifecycle batch", async () => {
    return withBillingLock(async () => {
      const subs = await basePrisma.subscription.findMany({
        where: { status: { in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
        include: { plan: { select: { interval: true, pricePkr: true } } },
      });
      let invoicesCreated = 0;
      let markedPastDue = 0;
      let suspended = 0;
      for (const sub of subs) {
        const r = await processSubscriptionForRestaurant(sub, now);
        invoicesCreated += r.invoicesCreated;
        markedPastDue += r.markedPastDue;
        suspended += r.suspended;
      }
      return { invoicesCreated, markedPastDue, suspended, overdueInvoices: 0 };
    });
  });
}
