import { CashShiftStatus, OrderSource, PaymentMethod } from "@prisma/client";
import { prisma } from "./prisma";

export async function listRecentPosOrders(
  branchId: string,
  cashierId: string,
  limit = 50
) {
  const shift = await prisma.cashShift.findFirst({
    where: { branchId, cashierId, status: CashShiftStatus.OPEN },
  });
  const since = shift?.openedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      branchId,
      orderSource: OrderSource.POS,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      payments: { orderBy: { sortOrder: "asc" } },
      diningTable: { select: { label: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    fulfillmentType: o.fulfillmentType,
    table: o.tableNumber ?? o.diningTable?.label ?? null,
    total: Number(o.total),
    paymentMethod: o.paymentMethod,
    payments: o.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      tendered: p.tendered != null ? Number(p.tendered) : null,
      changeGiven: p.changeGiven != null ? Number(p.changeGiven) : null,
    })),
    status: o.status,
    paymentStatus: o.paymentStatus,
  }));
}

export function summarizeOrderPayments(
  payments: { method: PaymentMethod; amount: { toString(): string } }[]
) {
  const cashMinor = payments
    .filter((p) => p.method === PaymentMethod.CASH)
    .reduce((s, p) => s + Number(p.amount), 0);
  const cardMinor = payments
    .filter((p) => p.method === PaymentMethod.CARD)
    .reduce((s, p) => s + Number(p.amount), 0);
  return { cashTotal: cashMinor, cardTotal: cardMinor };
}
