import { FulfillmentType, OrderStatus, PaymentMethod } from "@prisma/client";

export type OrderPaymentRow = {
  paymentStatus: string;
  paymentMethod: PaymentMethod | null;
  total: number;
  payments: { method: PaymentMethod; amount: number }[];
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
};

export type DerivedPayment = {
  status: "paid" | "partial" | "unpaid" | "cod";
  label: string;
  methods: PaymentMethod[];
  amountDue: number;
  codAmount: number | null;
};

function sumPayments(payments: { amount: number }[]) {
  return payments.reduce((s, p) => s + p.amount, 0);
}

export function deriveOrderPayment(row: OrderPaymentRow): DerivedPayment {
  const total = row.total;
  const paid = sumPayments(row.payments);
  const methods = [...new Set(row.payments.map((p) => p.method))];
  const storeStatus = String(row.paymentStatus || "").toUpperCase();

  if (storeStatus === "REFUNDED" || storeStatus === "PARTIAL_REFUND") {
    return {
      status: "paid",
      label: storeStatus === "REFUNDED" ? "Refunded" : "Partial refund",
      methods,
      amountDue: 0,
      codAmount: null,
    };
  }

  if (paid >= total - 0.01 || storeStatus === "PAID") {
    const methodLabel =
      methods.length === 1
        ? methods[0] === PaymentMethod.CARD
          ? "Card"
          : "Cash"
        : methods.length > 1
          ? "Split"
          : row.paymentMethod === PaymentMethod.CARD
            ? "Card"
            : row.paymentMethod === PaymentMethod.CASH
              ? "Cash"
              : "Paid";
    return {
      status: "paid",
      label: `Paid (${methodLabel})`,
      methods: methods.length ? methods : row.paymentMethod ? [row.paymentMethod] : [],
      amountDue: 0,
      codAmount: null,
    };
  }

  if (paid > 0 && paid < total) {
    return {
      status: "partial",
      label: "Partly paid",
      methods,
      amountDue: Math.round((total - paid) * 100) / 100,
      codAmount: null,
    };
  }

  const isCod =
    row.fulfillmentType === FulfillmentType.DELIVERY &&
    row.status !== OrderStatus.CANCELLED &&
    (storeStatus === "UNPAID" || !row.paymentMethod);

  if (isCod) {
    return {
      status: "cod",
      label: `Unpaid · COD`,
      methods: [],
      amountDue: total,
      codAmount: total,
    };
  }

  return {
    status: "unpaid",
    label: "Unpaid",
    methods: [],
    amountDue: total,
    codAmount: null,
  };
}

export function paymentFilterMatches(filter: string, derived: DerivedPayment): boolean {
  switch (filter) {
    case "paid":
      return derived.status === "paid";
    case "unpaid":
      return derived.status === "unpaid" || derived.status === "cod";
    case "cod":
      return derived.status === "cod";
    case "partial":
      return derived.status === "partial";
    default:
      return true;
  }
}
