import { describe, expect, it, vi } from "vitest";
import { PlatformInvoiceStatus } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";
import { runPlatformDunningJob } from "../src/lib/platform/dunning-job";
import type { BillingNotificationChannel } from "../src/lib/platform/billing-notify-channel";
import { updatePlatformSettings, loadPlatformSettings } from "../src/lib/platform/platform-settings";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe.skipIf(!hasDb)("platform dunning", () => {
  it("does not send duplicate reminders for the same offset", async () => {
    const settings = await loadPlatformSettings();
    await updatePlatformSettings(settings.version, {
      dunning: { enabled: true, reminderOffsetsDays: [0] },
    });

    const sub = await basePrisma.subscription.findUnique({ where: { restaurantId: DEFAULT_RESTAURANT_ID } });
    expect(sub).toBeTruthy();
    const due = new Date();
    due.setUTCHours(12, 0, 0, 0);
    const invoice = await basePrisma.platformInvoice.create({
      data: {
        restaurantId: DEFAULT_RESTAURANT_ID,
        subscriptionId: sub!.id,
        invoiceNumber: `DUN-${Date.now()}`,
        status: PlatformInvoiceStatus.OPEN,
        amountPkr: 1000,
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-02-01"),
        dueAt: due,
      },
    });

    const sends: string[] = [];
    const channel: BillingNotificationChannel = {
      send: vi.fn(async (p) => {
        sends.push(p.to);
      }),
    };

    await runPlatformDunningJob(due, channel);
    await runPlatformDunningJob(due, channel);

    const logs = await basePrisma.platformInvoiceReminderLog.count({ where: { invoiceId: invoice.id } });
    expect(logs).toBe(1);
    expect(sends.length).toBeGreaterThan(0);
  });
});
