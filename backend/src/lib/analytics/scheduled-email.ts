import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { sendEmail } from "../email";
import { buildAnalyticsOverview } from "./overview";
import { parseCompareMode } from "./range";
import { storeDateKey } from "../dashboard/dates";
import { runDailyCloseoutEmailJob } from "../reports/daily-closeout-email";

export async function runAnalyticsEmailJob(now = new Date()) {
  const settings = await getStoreSettings();
  if (!settings.analyticsEmailEnabled) return;
  const recipients = settings.analyticsEmailRecipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!recipients.length) return;

  const tz = settings.timezone || "Asia/Karachi";
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)
  );
  if (hour !== settings.analyticsEmailSendHour) return;

  const todayKey = storeDateKey(tz, now);
  const last = settings.analyticsEmailLastSentAt;
  if (last) {
    const lastKey = storeDateKey(tz, last);
    if (settings.analyticsEmailFrequency === "daily" && lastKey === todayKey) return;
    if (settings.analyticsEmailFrequency === "weekly") {
      const daysSince = Math.floor((now.getTime() - last.getTime()) / 86400000);
      if (daysSince < 6) return;
    }
  }

  const preset = settings.analyticsEmailFrequency === "daily" ? "yesterday" : "last_week";
  try {
    const overview = await buildAnalyticsOverview({
      preset,
      compare: parseCompareMode("previous"),
      granularity: "day",
      branchWhere: {},
      timezone: tz,
      role: Role.ADMIN,
      weekStartDay: settings.weekStartDay ?? 1,
      minInsightDays: settings.analyticsInsightMinDays ?? 7,
      minInsightOrders: settings.analyticsInsightMinOrders ?? 20,
    });

    const subject = `Analytics summary — ${overview.meta.range.fromKey} to ${overview.meta.range.toKey}`;
    const text = [
      `Booked: ${overview.kpis.booked?.value ?? "—"} (${overview.kpis.booked?.deltaPercent ?? "—"}%)`,
      `Collected: ${overview.kpis.collected?.value ?? "—"}`,
      `Orders: ${overview.kpis.ordersCount.value}`,
      `Completed: ${overview.kpis.completedCount.value}`,
      `Cancellations: ${overview.cancellations.count} (${overview.cancellations.rate}%)`,
      `Late orders: ${overview.operations?.latePercent ?? "—"}%`,
      "",
      "Open analytics in admin for full detail.",
    ].join("\n");

    for (const to of recipients) {
      const ok = await sendEmail(to, subject, `<pre>${text}</pre>`, text);
      if (!ok) console.error("[analytics email] failed to send to", to);
    }

    await prisma.storeSettings.update({
      where: { id: "default" },
      data: { analyticsEmailLastSentAt: now },
    });
  } catch (err) {
    console.error("[analytics email]", err);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startAnalyticsEmailScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    void runAnalyticsEmailJob();
    void runDailyCloseoutEmailJob();
  }, 15 * 60 * 1000);
  timer.unref();
}

export function stopAnalyticsEmailScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
