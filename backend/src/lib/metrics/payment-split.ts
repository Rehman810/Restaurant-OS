import { FulfillmentType, OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { deriveOrderPayment, type OrderPaymentRow } from "../admin-orders/payment";
import { collectedOrderWhere } from "./definitions";
import { roundMoney } from "../dashboard/kpi";

export type CollectedPaymentSplit = {
  cash: number;
  card: number;
  /** Cash collected on delivery (COD) for completed orders that day. */
  codReceived: number;
  /** Completed orders paid without method/payment rows (legacy). */
  unspecified: number;
  total: number;
};

export type NotYetCollected = {
  unpaid: number;
  codDue: number;
  partial: number;
  total: number;
};

export type PaymentReconciliation = {
  split: CollectedPaymentSplit;
  notYetCollected: NotYetCollected;
  reconcilesBooked: boolean;
  reconcilesCollected: boolean;
  bookedDifference: number;
  collectedDifference: number;
  missingPaymentMethodOrders: { id: string; orderNumber: string }[];
};

function toPayRow(o: {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  paymentMethod: PaymentMethod | null;
  total: { toString(): string };
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  payments: { method: PaymentMethod; amount: { toString(): string } }[];
}): OrderPaymentRow {
  return {
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    total: Number(o.total),
    fulfillmentType: o.fulfillmentType,
    status: o.status,
    payments: o.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    })),
  };
}

/** Payment split for completed orders in period — uses OrderPayment rows, then order.paymentMethod. */
export async function buildPaymentReconciliation(
  branchWhere: Prisma.OrderWhereInput,
  startUtc: Date,
  endUtc: Date,
  bookedTotal: number
): Promise<PaymentReconciliation> {
  const collectedWhere = collectedOrderWhere(branchWhere, startUtc, endUtc);
  const bookedWhere = {
    ...branchWhere,
    createdAt: { gte: startUtc, lte: endUtc },
    status: { not: OrderStatus.CANCELLED },
  };

  const [collectedOrders, bookedOrders] = await Promise.all([
    prisma.order.findMany({
      where: collectedWhere,
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        fulfillmentType: true,
        status: true,
        orderSource: true,
        payments: { select: { method: true, amount: true } },
      },
    }),
    prisma.order.findMany({
      where: bookedWhere,
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        fulfillmentType: true,
        status: true,
        payments: { select: { method: true, amount: true } },
      },
    }),
  ]);

  const split: CollectedPaymentSplit = {
    cash: 0,
    card: 0,
    codReceived: 0,
    unspecified: 0,
    total: 0,
  };
  const missingPaymentMethodOrders: { id: string; orderNumber: string }[] = [];

  for (const o of collectedOrders) {
    const total = Number(o.total);
    const row = toPayRow(o);
    const derived = deriveOrderPayment(row);
    const paidFromRows = row.payments.reduce((s, p) => s + p.amount, 0);

    if (row.payments.length > 0) {
      for (const p of row.payments) {
        const amt = roundMoney(p.amount);
        if (p.method === PaymentMethod.CASH) {
          if (o.fulfillmentType === FulfillmentType.DELIVERY) split.codReceived += amt;
          else split.cash += amt;
        } else if (p.method === PaymentMethod.CARD) {
          split.card += amt;
        }
      }
    } else if (derived.status === "paid" && o.paymentMethod) {
      const amt = roundMoney(total);
      if (o.paymentMethod === PaymentMethod.CASH) {
        if (o.fulfillmentType === FulfillmentType.DELIVERY) split.codReceived += amt;
        else split.cash += amt;
      } else {
        split.card += amt;
      }
    } else if (derived.status === "paid") {
      split.unspecified += roundMoney(total);
      missingPaymentMethodOrders.push({ id: o.id, orderNumber: o.orderNumber });
    } else {
      split.unspecified += roundMoney(paidFromRows > 0 ? paidFromRows : total);
      if (!o.paymentMethod && !row.payments.length) {
        missingPaymentMethodOrders.push({ id: o.id, orderNumber: o.orderNumber });
      }
    }
  }

  split.cash = roundMoney(split.cash);
  split.card = roundMoney(split.card);
  split.codReceived = roundMoney(split.codReceived);
  split.unspecified = roundMoney(split.unspecified);
  split.total = roundMoney(split.cash + split.card + split.codReceived + split.unspecified);

  const notYet: NotYetCollected = { unpaid: 0, codDue: 0, partial: 0, total: 0 };
  for (const o of bookedOrders) {
    if (collectedOrders.some((c) => c.id === o.id)) continue;
    const derived = deriveOrderPayment(toPayRow(o));
    if (derived.status === "cod") {
      notYet.codDue += derived.amountDue;
    } else if (derived.status === "partial") {
      notYet.partial += derived.amountDue;
    } else if (derived.status === "unpaid") {
      notYet.unpaid += derived.amountDue;
    }
  }
  notYet.unpaid = roundMoney(notYet.unpaid);
  notYet.codDue = roundMoney(notYet.codDue);
  notYet.partial = roundMoney(notYet.partial);
  notYet.total = roundMoney(notYet.unpaid + notYet.codDue + notYet.partial);

  const collectedTotal = roundMoney(
    collectedOrders.reduce((s, o) => s + Number(o.total), 0)
  );
  const bookedRounded = roundMoney(bookedTotal);
  const bookedDifference = roundMoney(bookedRounded - (split.total + notYet.total));
  const collectedDifference = roundMoney(collectedTotal - split.total);

  const reconcilesCollected = Math.abs(collectedDifference) < 0.02;
  const reconcilesBooked = Math.abs(bookedDifference) < 0.02;

  if (!reconcilesCollected || !reconcilesBooked) {
    console.warn("[daily-summary] reconciliation", {
      branchWhere,
      startUtc,
      endUtc,
      collectedTotal,
      splitTotal: split.total,
      bookedRounded,
      notYetTotal: notYet.total,
      bookedDifference,
      collectedDifference,
    });
  }

  return {
    split,
    notYetCollected: notYet,
    reconcilesBooked,
    reconcilesCollected,
    bookedDifference,
    collectedDifference,
    missingPaymentMethodOrders,
  };
}
