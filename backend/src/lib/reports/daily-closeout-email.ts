import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { sendEmail } from "../email";
import { storeDateKey } from "../dashboard/dates";
import { getDefaultBranchId } from "../branch-scope";
import { buildDailyCloseOut } from "./daily-close-out";

export function formatDailyCloseoutEmailText(
  payload: Awaited<ReturnType<typeof buildDailyCloseOut>>,
  adminLink: string
) {
  const m = payload.money;
  const lines = [
    `Daily close-out — ${payload.meta.date}`,
    `Status: ${payload.meta.status}`,
    payload.meta.finalReasons.length ? `Notes: ${payload.meta.finalReasons.join("; ")}` : "",
    "",
    `Collected: ${m.collected.value} (booked ${m.booked.value})`,
    `Payment split — Cash ${m.paymentSplit.cash}, Card ${m.paymentSplit.card}, COD ${m.paymentSplit.codReceived}`,
    `Not yet collected: ${m.notYetCollected.total}`,
    "",
    `Orders: ${payload.orders.total.value} · Completed ${payload.orders.completed.value}`,
    "",
    "Top items:",
    ...payload.topItems.slice(0, 5).map((t) => {
      const row = t as { name: string; quantity: number; revenue: number };
      return `  · ${row.name} — ${row.quantity} (${row.revenue})`;
    }),
    "",
    payload.needsAttention.length
      ? `Needs attention (${payload.needsAttention.length}):\n${payload.needsAttention.map((n) => `  · ${n.message}`).join("\n")}`
      : "Needs attention: none",
    "",
    adminLink,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

function storeTimeParts(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

export async function runDailyCloseoutEmailJob(
  now = new Date(),
  force = false,
  opts?: { persistLastSent?: boolean }
) {
  const settings = await getStoreSettings();
  if (!force && !settings.dailyCloseoutEmailEnabled) return { sent: false, reason: "disabled" };

  const recipients = (settings.dailyCloseoutEmailRecipients || settings.analyticsEmailRecipients || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "no_recipients" };

  const tz = settings.timezone || "Asia/Karachi";
  const { hour, minute } = storeTimeParts(tz, now);
  const sendHour = settings.dailyCloseoutEmailSendHour ?? 23;
  const sendMinute = settings.dailyCloseoutEmailSendMinute ?? 30;
  if (
    !force &&
    (hour !== sendHour || minute < sendMinute || minute >= sendMinute + 15)
  ) {
    return { sent: false, reason: "outside_window" };
  }

  const todayKey = storeDateKey(tz, now);
  const last = settings.dailyCloseoutEmailLastSentAt;
  if (!force && last && storeDateKey(tz, last) === todayKey) {
    return { sent: false, reason: "already_sent" };
  }

  const branchId = await getDefaultBranchId();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const payload = await buildDailyCloseOut({
    branchId,
    branchName: branch?.name ?? "Branch",
    dateKey: todayKey,
    timezone: tz,
    role: Role.ADMIN,
    compare: "yesterday",
  });

  const adminLink = "Open admin → Daily summary for the full close-out.";
  const text = formatDailyCloseoutEmailText(payload, adminLink);
  const subject = `Daily close-out — ${todayKey} (${payload.meta.status})`;

  for (const to of recipients) {
    const ok = await sendEmail(to, subject, `<pre>${text}</pre>`, text);
    if (!ok) console.error("[daily-closeout email] failed to send to", to);
  }

  if (opts?.persistLastSent !== false) {
    await prisma.storeSettings.update({
      where: { id: settings.id },
      data: { dailyCloseoutEmailLastSentAt: now },
    });
  }

  return { sent: true, recipients: recipients.length };
}

export async function sendDailyCloseoutTestEmail() {
  return runDailyCloseoutEmailJob(new Date(), true, { persistLastSent: false });
}
