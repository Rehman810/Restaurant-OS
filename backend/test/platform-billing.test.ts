import { describe, expect, it } from "vitest";
import { PlatformInvoiceStatus, PlatformPaymentMethod } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";
import { runPlatformBillingJob } from "../src/lib/platform/billing-job";
import { recordManualPlatformPayment } from "../src/lib/platform/payments";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));

describe.skipIf(!hasDb)("platform billing", () => {
  it("creates an open invoice after the billing period ends", async () => {
    const sub = await basePrisma.subscription.findUnique({
      where: { restaurantId: DEFAULT_RESTAURANT_ID },
      include: { plan: true },
    });
    expect(sub).toBeTruthy();
    const ended = new Date("2020-01-01T00:00:00.000Z");
    await basePrisma.subscription.update({
      where: { id: sub!.id },
      data: { currentPeriodEnd: ended, status: "ACTIVE" },
    });
    const invoiceIds = (
      await basePrisma.platformInvoice.findMany({
        where: { subscriptionId: sub!.id },
        select: { id: true },
      })
    ).map((row) => row.id);
    if (invoiceIds.length) {
      await basePrisma.platformPayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await basePrisma.platformInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    const result = await runPlatformBillingJob(new Date("2020-02-01T00:00:00.000Z"));
    expect(result).toMatchObject({ invoicesCreated: 1 });

    const invoice = await basePrisma.platformInvoice.findFirst({
      where: { subscriptionId: sub!.id, status: PlatformInvoiceStatus.OPEN },
    });
    expect(invoice?.amountPkr).toBe(sub!.plan.pricePkr);

    await recordManualPlatformPayment({
      invoiceId: invoice!.id,
      method: PlatformPaymentMethod.BANK_TRANSFER,
      amountPkr: invoice!.amountPkr,
      reference: "test-txn",
    });

    const paid = await basePrisma.platformInvoice.findUnique({ where: { id: invoice!.id } });
    expect(paid?.status).toBe(PlatformInvoiceStatus.PAID);
  });
});
