import { describe, expect, it } from "vitest";
import { FulfillmentType, PaymentMethod, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { syncPosOrderFromOffline } from "../src/lib/pos-offline-sync";
import { openCashShift } from "../src/lib/cash-shift";
import { getStoreSettings } from "../src/lib/settings-data";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[POS-OFF-04] offline sync integration", () => {
  it("idempotent sync creates one order", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    const cashier = await prisma.user.findFirst({ where: { role: Role.CASHIER } });
    const menuItem = await prisma.menuItem.findFirst({ where: { isAvailable: true } });
    if (!branch || !cashier || !menuItem) return;

    await prisma.cashShift.updateMany({
      where: { branchId: branch.id, cashierId: cashier.id, status: "OPEN" },
      data: { status: "CLOSED" },
    });
    await openCashShift(branch.id, cashier.id, 0);

    const settings = await getStoreSettings();
    const address = `${settings.storeName} — ${settings.address}`;
    const clientOrderId = `test-sync-${Date.now()}`;
    const body = {
      clientOrderId,
      offlineLabel: "OFF-TEST",
      clientCreatedAt: new Date().toISOString(),
      deviceLabel: "TEST-DEVICE",
      clientClaimedTotal: 9999,
      items: [{ menuItemId: menuItem.id, quantity: 1 }],
      fulfillmentType: FulfillmentType.PICKUP,
      paymentMethod: PaymentMethod.CASH,
      customerName: "Offline test",
    };

    const first = await syncPosOrderFromOffline(cashier.id, branch.id, body, address);
    const second = await syncPosOrderFromOffline(cashier.id, branch.id, body, address);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.order.id).toBe(second.order.id);
    expect(first.order.needsReview).toBe(true);

    const count = await prisma.order.count({ where: { posClientOrderId: clientOrderId } });
    expect(count).toBe(1);

    await prisma.order.delete({ where: { id: first.order.id } });
  });
});
