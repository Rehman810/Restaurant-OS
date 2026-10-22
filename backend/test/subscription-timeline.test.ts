import { describe, expect, it } from "vitest";
import { PlanInterval, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { buildSubscriptionTimeline, daysRemaining } from "../src/lib/platform/subscription-timeline";

describe("subscription timeline", () => {
  it("shows trial days remaining", () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    const created = new Date("2026-10-09T12:00:00.000Z");
    const trialEnds = new Date("2026-11-05T12:00:00.000Z");
    const t = buildSubscriptionTimeline({
      subscriptionStatus: SubscriptionStatus.TRIALING,
      tenantStatus: TenantStatus.TRIAL,
      planInterval: PlanInterval.MONTHLY,
      trialEndsAt: trialEnds,
      currentPeriodStart: created,
      currentPeriodEnd: new Date("2026-11-09T12:00:00.000Z"),
      subscriptionCreatedAt: created,
      hasOpenInvoice: false,
      openInvoiceDueAt: null,
      now,
    });
    expect(t.phase).toBe("trialing");
    expect(t.trialTotalDays).toBe(27);
    expect(t.trialDaysRemaining).toBe(daysRemaining(trialEnds, now));
    expect(t.headline).toContain("left");
  });

  it("marks past due as read-only", () => {
    const t = buildSubscriptionTimeline({
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      tenantStatus: TenantStatus.PAST_DUE,
      planInterval: PlanInterval.YEARLY,
      trialEndsAt: null,
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
      subscriptionCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      hasOpenInvoice: true,
      openInvoiceDueAt: new Date("2026-10-20T00:00:00.000Z"),
      now: new Date("2026-10-23T00:00:00.000Z"),
    });
    expect(t.phase).toBe("past_due");
    expect(t.adminReadOnly).toBe(true);
    expect(t.storefrontBlocked).toBe(true);
  });
});
