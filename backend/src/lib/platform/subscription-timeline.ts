import { PlanInterval, SubscriptionStatus, TenantStatus } from "@prisma/client";

export type SubscriptionTimelineInput = {
  subscriptionStatus: SubscriptionStatus;
  tenantStatus: TenantStatus;
  planInterval: PlanInterval;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  subscriptionCreatedAt: Date;
  hasOpenInvoice: boolean;
  openInvoiceDueAt: Date | null;
  now?: Date;
};

export type SubscriptionTimeline = {
  phase: "trialing" | "active" | "past_due" | "suspended" | "cancelled" | "none";
  interval: PlanInterval;
  intervalLabel: string;
  trialTotalDays: number | null;
  trialDaysRemaining: number | null;
  trialEndsAt: string | null;
  periodStart: string;
  periodEnd: string;
  periodDaysRemaining: number;
  headline: string;
  detail: string;
  urgency: "ok" | "info" | "warning" | "critical";
  adminReadOnly: boolean;
  storefrontBlocked: boolean;
  staffLoginBlocked: boolean;
};

const MS_DAY = 86_400_000;

export function daysBetween(from: Date, to: Date) {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((end - start) / MS_DAY);
}

export function daysRemaining(until: Date, now = new Date()) {
  return Math.max(0, daysBetween(now, until));
}

export function intervalLabel(interval: PlanInterval) {
  return interval === PlanInterval.YEARLY ? "Yearly" : "Monthly";
}

function formatDayCount(n: number) {
  if (n === 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

export function buildSubscriptionTimeline(input: SubscriptionTimelineInput): SubscriptionTimeline {
  const now = input.now ?? new Date();
  const interval = input.planInterval;
  const intervalLabelText = intervalLabel(interval);

  const trialEndsAt = input.trialEndsAt;
  const trialTotalDays =
    trialEndsAt && input.subscriptionStatus === SubscriptionStatus.TRIALING
      ? Math.max(1, daysBetween(input.subscriptionCreatedAt, trialEndsAt))
      : trialEndsAt
        ? Math.max(1, daysBetween(input.subscriptionCreatedAt, trialEndsAt))
        : null;

  const trialDaysRemaining =
    input.subscriptionStatus === SubscriptionStatus.TRIALING && trialEndsAt
      ? daysRemaining(trialEndsAt, now)
      : null;

  const periodDaysRemaining = daysRemaining(input.currentPeriodEnd, now);

  let phase: SubscriptionTimeline["phase"] = "none";
  if (input.tenantStatus === TenantStatus.CANCELLED) phase = "cancelled";
  else if (input.tenantStatus === TenantStatus.SUSPENDED) phase = "suspended";
  else if (
    input.tenantStatus === TenantStatus.PAST_DUE ||
    input.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
    input.hasOpenInvoice
  ) {
    phase = "past_due";
  } else if (input.subscriptionStatus === SubscriptionStatus.TRIALING) {
    phase = "trialing";
  } else if (input.subscriptionStatus === SubscriptionStatus.ACTIVE) {
    phase = "active";
  }

  const adminReadOnly =
    input.tenantStatus === TenantStatus.SUSPENDED ||
    input.tenantStatus === TenantStatus.CANCELLED ||
    input.tenantStatus === TenantStatus.PAST_DUE ||
    input.tenantStatus === TenantStatus.LEAD;

  const storefrontBlocked =
    input.tenantStatus !== TenantStatus.ACTIVE && input.tenantStatus !== TenantStatus.TRIAL;

  const staffLoginBlocked =
    input.tenantStatus === TenantStatus.CANCELLED ||
    input.tenantStatus === TenantStatus.LEAD ||
    input.tenantStatus === TenantStatus.ARCHIVED;

  let headline = "Subscription";
  let detail = "";
  let urgency: SubscriptionTimeline["urgency"] = "ok";

  if (phase === "trialing" && trialEndsAt) {
    const left = trialDaysRemaining ?? 0;
    headline = left === 0 ? "Free trial ends today" : `Free trial · ${formatDayCount(left)} left`;
    detail = `${trialTotalDays ?? "—"}-day trial on ${intervalLabelText} billing · ends ${trialEndsAt.toISOString()}`;
    urgency = left <= 3 ? "critical" : left <= 7 ? "warning" : "info";
  } else if (phase === "active") {
    headline =
      periodDaysRemaining === 0
        ? `${intervalLabelText} plan renews today`
        : `${intervalLabelText} plan · ${formatDayCount(periodDaysRemaining)} until renewal`;
    detail = `Current period ends ${input.currentPeriodEnd.toISOString()}`;
    urgency = periodDaysRemaining <= 7 ? "warning" : "ok";
  } else if (phase === "past_due") {
    headline = "Payment required";
    const due = input.openInvoiceDueAt;
    if (due) {
      const overdueDays = daysBetween(due, now);
      if (overdueDays > 0) {
        detail = `Invoice overdue by ${formatDayCount(overdueDays)}. Pay to restore full access.`;
        urgency = "critical";
      } else {
        detail = `Invoice due ${due.toISOString()}. Admin panel is read-only until payment is recorded.`;
        urgency = "warning";
      }
    } else {
      detail = "Subscription payment is due. Contact support or open Plan and billing.";
      urgency = "warning";
    }
  } else if (phase === "suspended") {
    headline = "Account suspended";
    detail = "Ordering and changes are disabled until your operator reactivates the store.";
    urgency = "critical";
  } else if (phase === "cancelled") {
    headline = "Account closed";
    detail = "This store is cancelled. Sign-in may be disabled.";
    urgency = "critical";
  }

  return {
    phase,
    interval,
    intervalLabel: intervalLabelText,
    trialTotalDays,
    trialDaysRemaining,
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    periodStart: input.currentPeriodStart.toISOString(),
    periodEnd: input.currentPeriodEnd.toISOString(),
    periodDaysRemaining,
    headline,
    detail,
    urgency,
    adminReadOnly,
    storefrontBlocked,
    staffLoginBlocked,
  };
}
