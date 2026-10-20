"use client";

import { ArrowLeft, Minus, Plus, Printer, ShoppingBag } from "lucide-react";
import type { DeliveryArea, FulfillmentType, Order, PaymentMethod } from "@/lib/types";
import type { PosLine } from "@/lib/pos-cart";
import { pkr } from "@/lib/format";
import { CashShiftPanel } from "@/components/admin/pos/CashShiftPanel";
import { PosDiscountFields } from "@/components/admin/pos/PosDiscountFields";
import { PosPaymentPanel } from "@/components/admin/pos/PosPaymentPanel";
import type { PosPaymentRow } from "@/lib/pos/checkout-helpers";
import { deliveryCheckoutIncomplete } from "@/lib/pos/delivery-customer";

type ModeInfo = { id: FulfillmentType; label: string };

type Props = {
  mobileBack: () => void;
  itemCount: number;
  mode: FulfillmentType;
  modes: ModeInfo[];
  tableLabel: string | null;
  onOpenTable: () => void;
  onOpenCustomer: () => void;
  onHold: () => void;
  onShowHolds: () => void;
  holdCount: number;
  lines: PosLine[];
  onLineTap: (line: PosLine) => void;
  onQty: (id: string, qty: number) => void;
  onClearRequest: () => void;
  totals: {
    subtotal: number;
    deliveryFee: number;
    rawDeliveryFee: number;
    tax: number;
    taxEnabled: boolean;
    discountAmount: number;
    total: number;
  };
  maxCashierDiscountPercent: number;
  discountPercent: string;
  discountReasonCode: string;
  discountReasonNote: string;
  discountReasons: string[];
  onDiscountPercent: (v: string) => void;
  onDiscountReasonCode: (v: string) => void;
  onDiscountReasonNote: (v: string) => void;
  kitchenNote: string;
  onKitchenNote: (v: string) => void;
  payment: PaymentMethod;
  onPayment: (m: PaymentMethod) => void;
  cashTendered: string;
  onCashTendered: (v: string) => void;
  splitRows: PosPaymentRow[];
  onSplitRows: (rows: PosPaymentRow[]) => void;
  shiftOpen: boolean;
  onShiftChange: (open: boolean) => void;
  cashierName?: string;
  chargeBlocked: string | null;
  busy: boolean;
  onCharge: () => void;
  lastOrder: Order | null;
  onReprint: () => void;
  onOverridePrice: (line: PosLine) => void;
  sheetMode?: boolean;
  deliveryAreas?: DeliveryArea[];
  deliveryAreaId?: string;
  onDeliveryAreaId?: (id: string) => void;
  deliveryAddress?: string;
  onDeliveryAddress?: (v: string) => void;
  customerName?: string;
  onCustomerName?: (v: string) => void;
  customerPhone?: string;
  onCustomerPhone?: (v: string) => void;
};

export function PosCartPanel(props: Props) {
  const {
    mobileBack,
    itemCount,
    mode,
    tableLabel,
    onOpenTable,
    onOpenCustomer,
    onHold,
    onShowHolds,
    holdCount,
    lines,
    onLineTap,
    onQty,
    onClearRequest,
    totals,
    maxCashierDiscountPercent,
    discountPercent,
    discountReasonCode,
    discountReasonNote,
    discountReasons,
    onDiscountPercent,
    onDiscountReasonCode,
    onDiscountReasonNote,
    kitchenNote,
    onKitchenNote,
    payment,
    onPayment,
    cashTendered,
    onCashTendered,
    splitRows,
    onSplitRows,
    shiftOpen,
    onShiftChange,
    cashierName,
    chargeBlocked,
    busy,
    onCharge,
    lastOrder,
    onReprint,
    sheetMode,
    deliveryAreas = [],
    deliveryAreaId = "",
    onDeliveryAreaId,
    deliveryAddress = "",
    onDeliveryAddress,
    customerName = "",
    onCustomerName,
    customerPhone = "",
    onCustomerPhone,
  } = props;

  const deliveryIncomplete =
    mode === "DELIVERY" &&
    deliveryCheckoutIncomplete({
      deliveryAreaId,
      deliveryAddress,
      customerName,
      customerPhone,
    });

  const checkoutMaxH = sheetMode
    ? "max-h-[min(44dvh,20rem)]"
    : "max-h-[min(32vh,17rem)] md:max-h-[min(36vh,19rem)]";

  return (
    <div className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${sheetMode ? "max-h-[inherit]" : ""}`}>
      <div className="shrink-0">
      {sheetMode && (
        <div className="flex shrink-0 justify-center py-2 md:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
        </div>
      )}
      <div className="border-b border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/80 sm:px-4 md:py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={mobileBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-stone-700 ring-1 ring-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:hidden"
            aria-label="Back to menu"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-stone-900 dark:text-stone-50">Current order</p>
            <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
              {mode === "DINE_IN" && tableLabel ? ` · Table ${tableLabel}` : ""}
              {mode === "DELIVERY" ? " · Delivery" : ""}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 md:mt-1.5 md:flex-nowrap">
          <button
            type="button"
            onClick={onHold}
            className="min-h-10 flex-1 rounded-lg px-2 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200 dark:text-stone-200 dark:ring-stone-600 md:min-h-9 md:flex-none md:px-2.5"
          >
            Hold
          </button>
          {holdCount > 0 && (
            <button
              type="button"
              onClick={onShowHolds}
              className="min-h-10 flex-1 rounded-lg px-2 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200 md:min-h-9 md:flex-none md:px-2.5"
            >
              Held ({holdCount})
            </button>
          )}
          {lines.length > 0 && (
            <button
              type="button"
              onClick={onClearRequest}
              className="min-h-10 flex-1 rounded-lg px-2 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100 md:min-h-9 md:flex-none md:px-2.5"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCustomer}
            className={`min-h-10 w-full rounded-lg bg-white px-2 text-[11px] font-semibold text-stone-700 ring-1 dark:bg-stone-800 dark:text-stone-200 md:min-h-9 md:w-auto md:px-2.5 ${
              deliveryIncomplete
                ? "ring-2 ring-amber-500 dark:ring-amber-400"
                : "ring-stone-200 dark:ring-stone-600"
            }`}
          >
            {mode === "DELIVERY" && deliveryIncomplete
              ? "Customer & delivery *"
              : `Customer${deliveryIncomplete && mode === "DELIVERY" ? " *" : ""}`}
          </button>
        </div>
      </div>

      {mode === "DELIVERY" && deliveryIncomplete && (
        <button
          type="button"
          onClick={onOpenCustomer}
          className="mx-3 mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {sheetMode
            ? "Tap to complete delivery details (name, phone, area, address)"
            : "Complete delivery details via Customer & delivery *"}
        </button>
      )}

      <div className="border-b border-stone-200 px-3 py-1.5 dark:border-stone-700 md:py-1">
        <CashShiftPanel
          paymentMethod={payment}
          onShiftChange={onShiftChange}
          compact
          cashierNameFallback={cashierName ?? "Cashier"}
        />
      </div>

      {mode === "DINE_IN" && (
        <div className="border-b border-stone-200 px-3 py-1.5 dark:border-stone-700">
          <button
            type="button"
            onClick={onOpenTable}
            className="flex min-h-10 w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 px-3 text-sm font-semibold text-brand-900 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-100"
          >
            {tableLabel ? `Table ${tableLabel}` : "Select table (required)"}
          </button>
        </div>
      )}
      </div>

      <div className="flex min-h-[10rem] flex-1 flex-col overflow-hidden md:min-h-[14rem]">
        <p className="shrink-0 border-b border-stone-100 bg-stone-50/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-800/50">
          Items in cart
        </p>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
        {lines.length === 0 ? (
          <li className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center dark:border-stone-600 dark:bg-stone-800/50">
            <ShoppingBag size={28} className="text-stone-400" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-stone-500">Cart is empty</p>
          </li>
        ) : (
          lines.map((l) => (
            <li key={l.id}>
              <div className="rounded-xl border border-stone-200 bg-white p-2.5 dark:border-stone-600 dark:bg-stone-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLineTap(l)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-bold leading-snug text-stone-900 dark:text-stone-50">{l.name}</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">
                      {pkr(l.price * l.quantity)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white dark:border-stone-600 dark:bg-stone-900"
                      aria-label="Decrease quantity"
                      onClick={() => onQty(l.id, l.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-sm font-black tabular-nums">{l.quantity}</span>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white dark:border-stone-600 dark:bg-stone-900"
                      aria-label="Increase quantity"
                      onClick={() => onQty(l.id, l.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {(l.optionsLabel && l.optionsLabel !== l.name) || l.instructions ? (
                  <button type="button" onClick={() => onLineTap(l)} className="mt-1.5 w-full text-left">
                    {l.optionsLabel && l.optionsLabel !== l.name && (
                      <p className="text-[11px] text-stone-500">{l.optionsLabel}</p>
                    )}
                    {l.instructions && (
                      <p className="text-[11px] italic text-stone-500">Note: {l.instructions}</p>
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))
        )}
        </ul>
      </div>

      <div
        className={`min-h-0 overflow-y-auto overscroll-contain border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-none sm:p-3 ${checkoutMaxH}`}
      >
        <label className="mb-2 block text-xs font-semibold text-stone-600 dark:text-stone-300">
          Kitchen note
          <input
            className="input mt-1 h-11 w-full text-sm"
            placeholder="Whole order note (prints on KOT)"
            value={kitchenNote}
            onChange={(e) => onKitchenNote(e.target.value)}
          />
        </label>

        <div className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200 dark:bg-stone-800/80 dark:ring-stone-600">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600 dark:text-stone-300">
              <span>Subtotal</span>
              <span className="font-medium tabular-nums">{pkr(totals.subtotal)}</span>
            </div>
            {totals.deliveryFee > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Delivery</span>
                <span className="font-medium tabular-nums">{pkr(totals.deliveryFee)}</span>
              </div>
            )}
            {totals.taxEnabled && totals.tax > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Tax</span>
                <span className="font-medium tabular-nums">{pkr(totals.tax)}</span>
              </div>
            )}
            <PosDiscountFields
              discountPercent={discountPercent}
              maxCashierDiscountPercent={maxCashierDiscountPercent}
              reasonCode={discountReasonCode}
              reasonNote={discountReasonNote}
              reasonOptions={discountReasons}
              onPercentChange={onDiscountPercent}
              onReasonCodeChange={onDiscountReasonCode}
              onReasonNoteChange={onDiscountReasonNote}
            />
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-medium tabular-nums">−{pkr(totals.discountAmount)}</span>
              </div>
            )}
            <div className="flex items-end justify-between border-t border-stone-200 pt-2 dark:border-stone-600">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total</span>
              <span
                className="text-2xl font-black tabular-nums text-brand-700 dark:text-brand-300"
                aria-live="polite"
                aria-atomic="true"
              >
                {pkr(totals.total)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <PosPaymentPanel
            payment={payment}
            total={totals.total}
            cashTendered={cashTendered}
            splitRows={splitRows}
            onPaymentChange={onPayment}
            onCashTenderedChange={onCashTendered}
            onSplitRowsChange={onSplitRows}
          />
        </div>

        {chargeBlocked && (
          <p className="mt-2 text-xs font-medium text-rose-700" role="alert">{chargeBlocked}</p>
        )}

        <button
          type="button"
          disabled={busy || Boolean(chargeBlocked) || !lines.length}
          onClick={onCharge}
          className="btn-primary mt-3 flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-40 sm:min-h-14 sm:text-base"
        >
          {busy ? "Processing…" : (
            <>
              <Printer size={18} />
              Charge &amp; Print · {pkr(totals.total)}
            </>
          )}
        </button>

        {lastOrder && (
          <button
            type="button"
            onClick={onReprint}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600"
          >
            <Printer size={14} /> Reprint {lastOrder.orderNumber}
          </button>
        )}
      </div>
    </div>
  );
}
