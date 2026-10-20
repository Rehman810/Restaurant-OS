import { PaymentMethod } from "@prisma/client";
import { toMinorUnits } from "./money";
import { POS_TOTAL_EPS_MINOR } from "./pos-totals";

export type PosPaymentInput = {
  method: PaymentMethod;
  amount: number;
  tendered?: number | null;
  changeGiven?: number | null;
};

export function normalizePosPayments(
  payments: PosPaymentInput[] | undefined,
  fallback: { method: PaymentMethod; total: number; tendered?: number; changeGiven?: number }
): PosPaymentInput[] {
  if (payments && payments.length > 0) return payments;
  const row: PosPaymentInput = {
    method: fallback.method,
    amount: fallback.total,
  };
  if (fallback.method === PaymentMethod.CASH) {
    if (fallback.tendered != null) row.tendered = fallback.tendered;
    if (fallback.changeGiven != null) row.changeGiven = fallback.changeGiven;
  }
  return [row];
}

export function validatePosPayments(
  payments: PosPaymentInput[],
  orderTotalMinor: number
):
  | {
      ok: true;
      cashDrawerMinor: number;
      primaryMethod: PaymentMethod;
      normalized: PosPaymentInput[];
    }
  | { ok: false; error: string } {
  if (!payments.length) {
    return { ok: false, error: "At least one payment is required." };
  }

  let sumMinor = 0;
  let cashDrawerMinor = 0;
  let primaryMethod = payments[0]!.method;
  let primaryAmountMinor = 0;
  const normalized: PosPaymentInput[] = [];

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i]!;
    const method = p.method === PaymentMethod.CARD ? PaymentMethod.CARD : PaymentMethod.CASH;
    const amountMinor = toMinorUnits(p.amount);
    if (amountMinor <= 0) {
      return { ok: false, error: "Payment amounts must be greater than zero." };
    }
    sumMinor += amountMinor;

    let tenderedMinor: number | null = null;
    let changeMinor: number | null = null;

    if (method === PaymentMethod.CASH) {
      if (p.tendered != null && Number.isFinite(Number(p.tendered))) {
        tenderedMinor = toMinorUnits(p.tendered);
        if (tenderedMinor < amountMinor) {
          return { ok: false, error: "Cash tendered cannot be less than the cash payment amount." };
        }
        changeMinor = tenderedMinor - amountMinor;
        if (p.changeGiven != null && Number.isFinite(Number(p.changeGiven))) {
          const givenMinor = toMinorUnits(p.changeGiven);
          if (Math.abs(givenMinor - changeMinor) > POS_TOTAL_EPS_MINOR) {
            return { ok: false, error: "Change given does not match tendered minus cash amount." };
          }
          changeMinor = givenMinor;
        }
      } else if (p.changeGiven != null) {
        return { ok: false, error: "Tendered amount is required when change is specified." };
      }
      cashDrawerMinor += amountMinor;
    } else if (p.tendered != null || p.changeGiven != null) {
      return { ok: false, error: "Tendered and change apply only to cash payments." };
    }

    if (amountMinor > primaryAmountMinor) {
      primaryAmountMinor = amountMinor;
      primaryMethod = method;
    }

    normalized.push({
      method,
      amount: amountMinor / 100,
      tendered: tenderedMinor != null ? tenderedMinor / 100 : undefined,
      changeGiven: changeMinor != null ? changeMinor / 100 : undefined,
    });
  }

  if (Math.abs(sumMinor - orderTotalMinor) > POS_TOTAL_EPS_MINOR) {
    return {
      ok: false,
      error: `Payments must equal order total (${(orderTotalMinor / 100).toFixed(2)}).`,
    };
  }

  return { ok: true, cashDrawerMinor, primaryMethod, normalized };
}
