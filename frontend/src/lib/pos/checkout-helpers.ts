import type { FulfillmentType, PaymentMethod } from "@/lib/types";
import { firstDeliveryCheckoutMessage, getDeliveryFieldErrors } from "./delivery-customer";
import { toMinorUnits } from "@/lib/money-units";

export type PosPaymentRow = {
  method: PaymentMethod;
  amount: number;
  tendered?: number;
  changeGiven?: number;
};

export function suggestQuickTenders(total: number): { exact: number; amounts: number[] } {
  const exact = total;
  const bases = [500, 1000, 5000];
  const rounded: number[] = [];
  for (const step of bases) {
    if (step > total) rounded.push(step);
  }
  const next100 = Math.ceil(total / 100) * 100;
  if (next100 > total && !rounded.includes(next100)) rounded.push(next100);
  const next500 = Math.ceil(total / 500) * 500;
  if (next500 > total && !rounded.includes(next500)) rounded.push(next500);
  return { exact, amounts: [...new Set(rounded)].sort((a, b) => a - b).slice(0, 4) };
}

export function cashChangeDue(tendered: number, cashPortion: number) {
  return (toMinorUnits(tendered) - toMinorUnits(cashPortion)) / 100;
}

export function buildPaymentsPayload(input: {
  rows: PosPaymentRow[];
  total: number;
  singleMethod: PaymentMethod;
  cashTendered?: number;
}): PosPaymentRow[] {
  if (input.rows.length > 0) {
    return input.rows.map((r) => {
      if (r.method !== "CASH" || r.tendered == null) return r;
      const change = Math.max(0, r.tendered - r.amount);
      return { ...r, changeGiven: change };
    });
  }
  const row: PosPaymentRow = { method: input.singleMethod, amount: input.total };
  if (input.singleMethod === "CASH" && input.cashTendered != null && input.cashTendered >= input.total) {
    row.tendered = input.cashTendered;
    row.changeGiven = input.cashTendered - input.total;
  } else if (input.singleMethod === "CASH" && input.cashTendered != null) {
    row.tendered = input.cashTendered;
  }
  return [row];
}

export function posChargeBlockedReason(ctx: {
  linesEmpty: boolean;
  mode: FulfillmentType;
  tableSessionId: string;
  deliveryAreaId: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  payment: PaymentMethod;
  shiftOpen: boolean;
  cashTendered: string;
  total: number;
  splitRows: PosPaymentRow[];
  discountPercent: number;
  discountReasonCode: string;
  discountReasonNote: string;
}): string | null {
  if (ctx.linesEmpty) return "Add items to the cart.";
  if (ctx.mode === "DINE_IN" && !ctx.tableSessionId) return "Select a table for dine-in.";
  if (ctx.mode === "DELIVERY") {
    const deliveryMsg = firstDeliveryCheckoutMessage(
      getDeliveryFieldErrors({
        deliveryAreaId: ctx.deliveryAreaId,
        deliveryAddress: ctx.deliveryAddress,
        customerName: ctx.customerName,
        customerPhone: ctx.customerPhone,
      })
    );
    if (deliveryMsg) return deliveryMsg;
  }
  if (ctx.payment === "CASH" && !ctx.shiftOpen) return "Open a cash shift before taking cash.";
  if (ctx.splitRows.length > 0) {
    const sum = ctx.splitRows.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(sum - ctx.total) > 0.02) return "Split payments must equal the total.";
    for (const r of ctx.splitRows) {
      if (r.method === "CASH" && r.tendered != null && r.tendered < r.amount) {
        return "Cash tendered is less than the cash portion.";
      }
    }
    return null;
  }
  if (ctx.payment === "CASH" && ctx.cashTendered.trim()) {
    const t = Number(ctx.cashTendered);
    if (Number.isFinite(t) && t < ctx.total) return `Short Rs ${(ctx.total - t).toFixed(0)} — add more cash.`;
  }
  if (ctx.discountPercent > 0 && !ctx.discountReasonCode.trim()) return "Select a discount reason.";
  if (ctx.discountReasonCode.toLowerCase() === "other" && !ctx.discountReasonNote.trim()) {
    return "Enter a note for discount reason Other.";
  }
  return null;
}
