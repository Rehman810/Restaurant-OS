export type SubscriptionTimeline = {
  phase: "trialing" | "active" | "past_due" | "suspended" | "cancelled" | "none";
  interval: string;
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

export type TenantAccessSnapshot = {
  status: string;
  statusReason: string;
};

export function formatSubscriptionDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function subscriptionBannerTone(urgency: SubscriptionTimeline["urgency"]) {
  switch (urgency) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100";
    default:
      return "border-stone-200 bg-stone-50 text-stone-800 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200";
  }
}
