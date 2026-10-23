"use client";

import Link from "next/link";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import {
  formatSubscriptionDate,
  subscriptionBannerTone,
  type SubscriptionTimeline,
  type TenantAccessSnapshot,
} from "@/lib/subscription-timeline";

type Props = {
  timeline: SubscriptionTimeline | null;
  tenant: TenantAccessSnapshot | null;
  isOwnerAdmin: boolean;
};

export function TenantSubscriptionBanner({ timeline, tenant, isOwnerAdmin }: Props) {
  if (!timeline || timeline.phase === "none") {
    return null;
  }
  if (timeline.phase === "active" && timeline.urgency === "ok") {
    return null;
  }

  const Icon =
    timeline.phase === "past_due" || timeline.phase === "suspended" ? CreditCard : timeline.urgency === "critical" ? AlertTriangle : Clock;

  const periodEndLabel = formatSubscriptionDate(timeline.periodEnd);
  const trialEndLabel = timeline.trialEndsAt ? formatSubscriptionDate(timeline.trialEndsAt) : null;

  let subline = timeline.detail;
  if (timeline.phase === "trialing" && trialEndLabel) {
    const left = timeline.trialDaysRemaining ?? 0;
    const leftLabel = left === 0 ? "ends today" : `${left} day${left === 1 ? "" : "s"} left`;
    subline = `Full access during trial · expires ${trialEndLabel} (${leftLabel})`;
  } else if (timeline.phase === "active") {
    subline = `${timeline.intervalLabel} billing · current period ends ${periodEndLabel}`;
  } else if (tenant?.statusReason) {
    subline = tenant.statusReason;
  }

  return (
    <div
      className={`mb-5 flex gap-3 rounded-xl border px-4 py-3 text-sm ${subscriptionBannerTone(timeline.urgency)}`}
      role="status"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{timeline.headline}</p>
        <p className="mt-0.5 text-xs leading-relaxed opacity-90">{subline}</p>
        {timeline.adminReadOnly ? (
          <p className="mt-1 text-xs font-medium opacity-90">
            Admin is read-only until billing is resolved. POS, kitchen, and online orders are limited.
          </p>
        ) : null}
      </div>
      {isOwnerAdmin ? (
        <Link
          href="/admin/billing"
          className="shrink-0 self-center rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm ring-1 ring-black/5 hover:bg-white dark:bg-stone-800 dark:text-stone-100 dark:ring-white/10"
        >
          Plan & billing
        </Link>
      ) : (
        <span className="shrink-0 self-center text-xs font-medium opacity-80">Ask store owner</span>
      )}
    </div>
  );
}
