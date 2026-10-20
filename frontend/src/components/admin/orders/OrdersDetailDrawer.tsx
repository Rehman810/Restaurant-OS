"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bike,
  Copy,
  Download,
  MapPin,
  Phone,
  Printer,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { fetchAdminOrderDetail } from "@/lib/admin-orders/api";
import type { AdminOrderDetail } from "@/lib/admin-orders/types";
import {
  dispatchStatusLabel,
  formatAgeSeconds,
  formatStoreTime12h,
  normalizeAddressDisplay,
} from "@/lib/admin-orders/helpers";
import { STATUS_THEME } from "@/lib/admin-status";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { pkr } from "@/lib/format";
import { mapsLink } from "@/lib/geolocation";
import { downloadInvoice } from "@/lib/api";
import { api } from "@/lib/api";
import { printKotForOrder } from "@/lib/print-kot";
import { printReceipt, ReceiptStore } from "@/lib/print-receipt";
import type { Order } from "@/lib/types";
import type { Role } from "@/lib/types";
import { Rider } from "@/lib/admin-types";
import { RiderPickerSheet } from "./RiderPickerSheet";

const CLOSE_MS = 340;

function allergyEmphasis(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("allerg") || lower.includes("no onion") || lower.includes("no garlic")) {
    return true;
  }
  return false;
}

export function OrdersDetailDrawer({
  orderId,
  timeZone,
  role,
  riders,
  onClose,
  onAction,
  onAssignRider,
  onCancel,
}: {
  orderId: string;
  timeZone: string;
  role?: Role;
  riders: Rider[];
  onClose: () => void;
  onAction: (detail: AdminOrderDetail, action: AdminOrderDetail["nextActions"][number]) => void;
  onAssignRider: (orderId: string, riderId: string) => void;
  onCancel: (detail: AdminOrderDetail) => void;
}) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [riderPicker, setRiderPicker] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchAdminOrderDetail(orderId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load order");
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  async function reprintReceipt() {
    if (!detail) return;
    setPrinting(true);
    try {
      const data = await api<{ order: Order; store: ReceiptStore }>(`/pos/receipt/${detail.id}`).catch(
        () => null
      );
      if (data) {
        printReceipt(data.order, data.store, { copies: "customer" });
      } else {
        const order = await api<Order>(`/orders/${detail.id}`);
        const pub = await api<{ storeName?: string; address?: string; phone?: string }>("/settings/public");
        printReceipt(order, {
          name: pub.storeName ?? "Store",
          address: pub.address ?? "",
          phone: pub.phone ?? "",
        });
      }
    } finally {
      setPrinting(false);
      void load();
    }
  }

  async function reprintKot() {
    if (!detail) return;
    setPrinting(true);
    try {
      await printKotForOrder(detail.id);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "KOT print failed");
    } finally {
      setPrinting(false);
    }
  }

  const theme = detail ? STATUS_THEME[detail.status] : STATUS_THEME.CONFIRMED;
  const primary = detail?.nextActions.find((a) => a.primary);
  const isAdmin = role === "ADMIN";
  const isManager = role === "ADMIN" || role === "MANAGER";

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end max-sm:flex-col" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close order details"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/70 backdrop-blur-[5px] max-sm:hidden ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={detail ? `Order ${detail.shortDisplay}` : "Order details"}
        className={`drawer-panel relative flex h-full w-full flex-col bg-white shadow-2xl dark:bg-stone-900 sm:max-w-[640px] sm:rounded-l-2xl max-sm:min-h-0 max-sm:flex-1 ${
          visible && !closing ? "translate-x-0 max-sm:translate-y-0" : "translate-x-full max-sm:translate-y-full"
        }`}
      >
        <div className={`h-1 shrink-0 ${theme.stripe} sm:rounded-tl-2xl`} />

        <header className="shrink-0 border-b border-stone-200 px-5 pb-4 pt-4 dark:border-stone-700 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-500">Order</p>
              <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-50">
                {detail?.shortDisplay ?? "…"}
              </h2>
              {detail && (
                <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                  <span className="font-mono">{detail.number}</span>
                  <button
                    type="button"
                    aria-label="Copy order number"
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100"
                    onClick={() => void navigator.clipboard?.writeText(detail.number)}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-stone-200 dark:border-stone-600"
            >
              <X size={18} />
            </button>
          </div>

          {detail && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FulfillmentBadge type={detail.type} size="md" />
              <StatusBadge status={detail.status} fulfillmentType={detail.type} size="md" />
              <span className="text-xs text-stone-500" title={formatStoreTime12h(detail.statusChangedAt, timeZone)}>
                {formatAgeSeconds(detail.ageSeconds)} · since {formatStoreTime12h(detail.statusChangedAt, timeZone)}
              </span>
              {detail.isLate && (
                <span className="text-xs font-bold uppercase text-red-700">Late</span>
              )}
              {detail.isStale && (
                <span className="text-xs font-bold uppercase text-amber-800">Stale</span>
              )}
            </div>
          )}
          {detail?.table && (
            <p className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">Table {detail.table}</p>
          )}
          {detail?.type === "DELIVERY" && detail.address && (
            <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
              {normalizeAddressDisplay(detail.address)}
              {detail.deliveryArea && ` · ${detail.deliveryArea}`}
            </p>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
              <button type="button" className="ml-2 font-bold underline" onClick={() => void load()}>Retry</button>
            </p>
          )}
          {!detail && !error && <div className="skeleton h-40 rounded-2xl" />}

          {detail && (
            <>
              <section className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Items</h3>
                <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 dark:divide-stone-700 dark:border-stone-700">
                  {detail.items.map((i) => (
                    <li key={i.id} className="px-4 py-3">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-900 dark:text-stone-100">
                            {i.quantity}× {i.name}
                          </p>
                          {i.optionsLabel && (
                            <p className="text-xs text-stone-500">{i.optionsLabel}</p>
                          )}
                          {i.instructions && (
                            <p
                              className={`mt-1 text-xs font-semibold ${
                                allergyEmphasis(i.instructions)
                                  ? "text-amber-900 dark:text-amber-200"
                                  : "text-stone-600"
                              }`}
                            >
                              {i.instructions}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-semibold">{pkr(i.price * i.quantity)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Totals</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Subtotal</dt>
                    <dd>{pkr(detail.totals.subtotal)}</dd>
                  </div>
                  {detail.totals.deliveryCharge > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Delivery</dt>
                      <dd>{pkr(detail.totals.deliveryCharge)}</dd>
                    </div>
                  )}
                  {detail.totals.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-stone-500">Tax</dt>
                      <dd>{pkr(detail.totals.taxAmount)}</dd>
                    </div>
                  )}
                  {detail.totals.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Discount</dt>
                      <dd>-{pkr(detail.totals.discountAmount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold dark:border-stone-700">
                    <dt>Total</dt>
                    <dd>{pkr(detail.totals.total)}</dd>
                  </div>
                </dl>
              </section>

              {detail.payment && (
                <section className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Payment</h3>
                  <p className="text-sm font-semibold">{detail.payment.label}</p>
                  {detail.payments?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-stone-600">
                      {detail.payments.map((p, idx) => (
                        <li key={idx}>
                          {p.method} {pkr(p.amount)}
                          {p.tendered != null && ` · tendered ${pkr(p.tendered)}`}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {detail.payment.amountDue > 0 && detail.payment.status === "cod" && (
                    <p className="mt-2 text-xs text-stone-500">
                      Collect {pkr(detail.payment.amountDue)} on delivery (recorded when marked delivered).
                    </p>
                  )}
                </section>
              )}

              <section className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Timeline</h3>
                <ol className="space-y-3 border-l-2 border-stone-200 pl-4 dark:border-stone-700">
                  {detail.timeline.map((e, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {dispatchStatusLabel(e.toStatus, detail.type)}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatStoreTime12h(e.at, timeZone)}
                        {e.actor ? ` · ${e.actor.name}` : ""}
                        {e.reason ? ` · ${e.reason}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Customer</h3>
                <dl className="rounded-xl border border-stone-200 dark:border-stone-700">
                  <div className="flex gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                    <User size={16} className="mt-0.5 text-stone-400" />
                    <div>
                      <dt className="text-[11px] text-stone-400">Name</dt>
                      <dd className="font-medium">{detail.customer.name}</dd>
                    </div>
                  </div>
                  <div className="flex gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                    <Phone size={16} className="mt-0.5 text-stone-400" />
                    <div>
                      <dt className="text-[11px] text-stone-400">Phone</dt>
                      <dd>
                        <a
                          href={`tel:${detail.customer.phone}`}
                          className="font-semibold text-brand-700 dark:text-brand-300"
                        >
                          {detail.customer.phone}
                        </a>
                      </dd>
                    </div>
                  </div>
                  <div className="px-4 py-3 text-xs text-stone-500">
                    {detail.customer.previousOrdersCount} previous orders
                    {detail.customer.recentOrders.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {detail.customer.recentOrders.map((o) => (
                          <li key={o.id} className="flex justify-between text-stone-700 dark:text-stone-300">
                            <span>{o.orderNumber}</span>
                            <span>{pkr(o.total)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </dl>
              </section>

              <section className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">Print</h3>
                <p className="text-xs text-stone-500">
                  KOT {detail.print.kotPrintCount ? `printed ${detail.print.kotPrintCount}×` : "not printed"}
                  {detail.print.kotLogs[0]?.isReprint && " (last was REPRINT)"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={printing}
                    className="btn-ghost min-h-[44px] text-xs"
                    onClick={() => void reprintReceipt()}
                  >
                    <Printer size={14} /> Reprint receipt
                  </button>
                  <button
                    type="button"
                    disabled={printing}
                    className="btn-ghost min-h-[44px] text-xs"
                    onClick={() => void reprintKot()}
                  >
                    <Printer size={14} /> Reprint KOT
                  </button>
                  {detail.print.invoice && (
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px] text-xs"
                      onClick={() => downloadInvoice(detail.id)}
                    >
                      <Download size={14} /> Invoice
                    </button>
                  )}
                </div>
              </section>

              {detail.notes && (
                <section className="mb-6">
                  <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <StickyNote size={16} className="text-amber-700" />
                    <p className="text-sm text-amber-900 dark:text-amber-100">{detail.notes}</p>
                  </div>
                </section>
              )}

              {isAdmin && detail.location && (detail.location.ip || detail.location.latitude) && (
                <section className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
                    Device & location
                  </h3>
                  <dl className="text-sm text-stone-700 dark:text-stone-300">
                    {detail.location.ip && (
                      <div>
                        <dt className="text-xs text-stone-500">IP</dt>
                        <dd className="font-mono">{detail.location.ip}</dd>
                      </div>
                    )}
                    {detail.location.latitude != null && detail.location.longitude != null && (
                      <a
                        href={mapsLink(detail.location.latitude, detail.location.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-brand-700"
                      >
                        <MapPin size={14} /> Open in maps
                      </a>
                    )}
                  </dl>
                </section>
              )}

              {detail.rider && (
                <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium">
                  <Bike size={15} /> {detail.rider.name}
                </div>
              )}
            </>
          )}
        </div>

        {detail && (
          <footer className="shrink-0 space-y-2 border-t border-stone-200 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-900 sm:px-7">
            {primary && (
              <button
                type="button"
                className="btn-primary min-h-[48px] w-full"
                onClick={() =>
                  primary.action === "cancel" ? onCancel(detail) : onAction(detail, primary)
                }
              >
                {primary.label}
              </button>
            )}
            {detail.type === "DELIVERY" && isManager && (
              <button
                type="button"
                className="btn-ghost min-h-[44px] w-full text-sm"
                onClick={() => setRiderPicker(true)}
              >
                {detail.rider ? "Reassign rider" : "Assign rider"}
              </button>
            )}
            {isManager && detail.source === "pos" && (
              <Link
                href={`/admin/pos?order=${detail.id}`}
                className="block text-center text-xs font-semibold text-stone-500 underline"
              >
                Refund or adjust via POS
              </Link>
            )}
          </footer>
        )}
      </aside>

      <RiderPickerSheet
        open={riderPicker}
        title="Assign rider"
        riders={riders}
        onClose={() => setRiderPicker(false)}
        onSelect={(id) => {
          setRiderPicker(false);
          onAssignRider(orderId, id);
          void load();
        }}
      />
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
