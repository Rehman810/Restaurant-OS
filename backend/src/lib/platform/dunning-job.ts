import { PlatformInvoiceStatus, Role, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { markJobFinished, markJobStarted } from "./job-runs";
import { loadPlatformSettings, dunningOffsetsFromSettings } from "./platform-settings";
import { renderDunningTemplate } from "./dunning-templates";
import { defaultBillingNotificationChannel } from "./billing-notify-channel";
import { karachiDateOnly } from "./karachi-time";
import { REAL_TENANT_FILTER } from "./real-tenants";

const JOB_KEY = "platform_dunning";

function reminderKeyForOffset(offsetDays: number) {
  if (offsetDays < 0) return `due_minus_${Math.abs(offsetDays)}`;
  if (offsetDays === 0) return "due_day";
  return `overdue_${offsetDays}`;
}

function dueDateOnly(dueAt: Date) {
  return karachiDateOnly(dueAt);
}

async function invoiceRecipientEmails(restaurantId: string, ownerEmail: string) {
  const emails = new Set<string>();
  const owner = ownerEmail.trim().toLowerCase();
  if (owner.includes("@")) emails.add(owner);
  const admins = await basePrisma.user.findMany({
    where: { restaurantId, role: Role.ADMIN, isActive: true },
    select: { email: true },
  });
  for (const u of admins) {
    const e = u.email.trim().toLowerCase();
    if (e.includes("@")) emails.add(e);
  }
  return [...emails];
}

export async function runPlatformDunningJob(
  now = new Date(),
  channel = defaultBillingNotificationChannel,
  triggeredBy = "scheduler"
) {
  const historyId = await markJobStarted(JOB_KEY, triggeredBy);
  try {
    const { data: settings } = await loadPlatformSettings();
    if (!settings.dunning?.enabled) {
      await markJobFinished(JOB_KEY, null, historyId);
      return { sent: 0, skipped: "disabled" };
    }
    const offsets = dunningOffsetsFromSettings(settings);
    const today = karachiDateOnly(now);
    let sent = 0;

    const openInvoices = await withoutTenant("dunning invoices", () =>
      basePrisma.platformInvoice.findMany({
        where: {
          status: PlatformInvoiceStatus.OPEN,
          restaurant: REAL_TENANT_FILTER,
        },
        include: {
          restaurant: { select: { id: true, displayName: true, slug: true, ownerEmail: true, status: true } },
        },
      })
    );

    for (const inv of openInvoices) {
      const due = dueDateOnly(inv.dueAt);
      const diffDays = Math.round((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
      for (const offset of offsets) {
        if (diffDays !== offset) continue;
        const key = reminderKeyForOffset(offset);
        const exists = await basePrisma.platformInvoiceReminderLog.findUnique({
          where: { invoiceId_reminderKey: { invoiceId: inv.id, reminderKey: key } },
        });
        if (exists) continue;

        const vars = {
          tenantName: inv.restaurant.displayName || inv.restaurant.slug,
          invoiceNumber: inv.invoiceNumber,
          amountPkr: String(inv.amountPkr),
          dueAt: inv.dueAt.toISOString().slice(0, 10),
          periodStart: inv.periodStart.toISOString().slice(0, 10),
          periodEnd: inv.periodEnd.toISOString().slice(0, 10),
          supportEmail: settings.supportEmail || "",
          reason: inv.restaurant.status === TenantStatus.SUSPENDED ? "Payment overdue" : "",
        };
        const body = renderDunningTemplate("paymentOverdue", settings, vars);
        const subject = `Payment reminder: ${inv.invoiceNumber}`;
        const emails = await invoiceRecipientEmails(inv.restaurantId, inv.restaurant.ownerEmail);
        for (const to of emails) {
          await channel.send({
            to,
            tenantName: vars.tenantName,
            subject,
            body,
            severity: offset >= 3 ? "urgent" : "warning",
          });
        }
        await basePrisma.platformInvoiceReminderLog.create({
          data: { invoiceId: inv.id, reminderKey: key, channel: "email" },
        });
        sent++;
      }
    }

    await markJobFinished(JOB_KEY, null, historyId);
    return { sent };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dunning job failed.";
    await markJobFinished(JOB_KEY, message, historyId);
    throw err;
  }
}
