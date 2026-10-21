"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  Copy,
  MessageCircle,
  Phone,
  ShieldOff,
  User,
  X,
} from "lucide-react";
import { AdminCustomer, AdminCustomerDetail } from "@/lib/admin-types";
import { fetchCustomerDetail, saveCustomerNotes } from "@/lib/admin-customers";
import { formatWhen, pkr } from "@/lib/format";
import { pkPhoneForWhatsApp } from "@/lib/phone";
import { SEGMENT_LABELS } from "@/lib/customer-segments";
import { StatusBadge } from "./StatusBadge";

const CLOSE_MS = 340;

function segmentClass(segment: AdminCustomerDetail["segment"]) {
  if (segment === "vip") return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800";
  if (segment === "at_risk") return "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-800";
  if (segment === "lapsed") return "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600";
  if (segment === "regular") return "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800";
  if (segment === "new") return "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800";
  return "";
}

export function CustomerDetailSheet({
  customer,
  isAdmin,
  blocked,
  onClose,
  onBlock,
  onUnblock,
}: {
  customer: AdminCustomer | null;
  isAdmin: boolean;
  blocked: boolean;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMsg, setNotesMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!customer) return;
    setClosing(false);
    setDetail(null);
    setError("");
    setNotesMsg("");
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
  }, [customer, close]);

  useEffect(() => {
    if (!customer) return;
    setLoading(true);
    fetchCustomerDetail(customer.id)
      .then((d) => {
        setDetail(d);
        setNotes(d.internalNotes ?? "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load customer.");
      })
      .finally(() => setLoading(false));
  }, [customer]);

  async function submitNotes(e: FormEvent) {
    e.preventDefault();
    if (!customer || !isAdmin) return;
    setSavingNotes(true);
    setNotesMsg("");
    try {
      await saveCustomerNotes(customer.id, notes);
      setNotesMsg("Notes saved.");
    } catch (err) {
      setNotesMsg(err instanceof Error ? err.message : "Could not save notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function copyPhone() {
    if (!detail?.phone) return;
    await navigator.clipboard.writeText(detail.phone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!customer) return null;

  const wa = detail?.phone ? pkPhoneForWhatsApp(detail.phone) : null;
  const joinedLabel = detail?.joinedSource === "first_order" ? "First order" : "Joined";

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/60 backdrop-blur-[4px] ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Customer ${customer.name}`}
        className={`drawer-panel relative flex h-full w-full max-w-[560px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] dark:bg-stone-900 dark:text-stone-100 dark:shadow-[-12px_0_48px_rgba(0,0,0,0.55)] dark:ring-1 dark:ring-stone-700 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-sky-500" />
        <header className="shrink-0 border-b border-stone-100 px-6 py-4 dark:border-stone-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Customer profile</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-xl font-semibold text-stone-900 dark:text-stone-50">
                <User size={18} className="text-sky-600" />
                {customer.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {blocked && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800">
                    Blocked
                  </span>
                )}
                {detail?.isGuest ? (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600">
                    Guest
                  </span>
                ) : (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-200 dark:ring-brand-800">
                    Registered
                  </span>
                )}
                {detail?.segment && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${segmentClass(detail.segment)}`}
                  >
                    {SEGMENT_LABELS[detail.segment]}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
              {error}
            </p>
          ) : detail ? (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Contact</h3>
                <div className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-300">
                  <p>{detail.email || "—"}</p>
                  <p>{detail.phone || "—"}</p>
                </div>
                {detail.phone && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                    <a
                      href={`tel:${detail.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    >
                      <Phone size={14} /> Call
                    </a>
                    <button
                      type="button"
                      onClick={copyPhone}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200"
                    >
                      <Copy size={14} /> {copied ? "Copied" : "Copy phone"}
                    </button>
                  </div>
                )}
              </section>

              <section className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-stone-700 dark:bg-stone-800/50">
                  <p className="text-xs text-stone-500">Lifetime spend</p>
                  <p className="mt-1 text-lg font-bold text-brand-800 dark:text-brand-300">{pkr(detail.totalSpent)}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-stone-700 dark:bg-stone-800/50">
                  <p className="text-xs text-stone-500">Orders</p>
                  <p className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-50">{detail.orderCount}</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-stone-700 dark:bg-stone-800/50">
                  <p className="text-xs text-stone-500">Avg order value</p>
                  <p className="mt-1 text-lg font-bold text-stone-900 dark:text-stone-50">
                    {pkr(Math.round(detail.avgOrderValue))}
                  </p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 dark:border-stone-700 dark:bg-stone-800/50">
                  <p className="text-xs text-stone-500">{joinedLabel}</p>
                  <p className="mt-1 font-semibold text-stone-900 dark:text-stone-50">{formatWhen(detail.createdAt)}</p>
                </div>
              </section>

              <section className="text-sm text-stone-600 dark:text-stone-400">
                <p>
                  First order: {detail.firstOrderAt ? formatWhen(detail.firstOrderAt) : "—"}
                </p>
                <p className="mt-1">
                  Last order: {detail.lastOrderAt ? formatWhen(detail.lastOrderAt) : "—"}
                  {detail.daysSinceLastOrder != null ? ` (${detail.daysSinceLastOrder} days ago)` : ""}
                </p>
              </section>

              {detail.favouriteDishes.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Favourite dishes</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {detail.favouriteDishes.map((d) => (
                      <li key={d.name} className="flex justify-between gap-2">
                        <span>{d.name}</span>
                        <span className="font-semibold text-stone-700 dark:text-stone-300">×{d.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Last 10 orders</h3>
                <ul className="mt-2 space-y-2">
                  {detail.recentOrders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                        onClick={close}
                        className="block rounded-xl border border-stone-200 px-3 py-2 transition hover:border-brand-200 hover:bg-brand-50/40 dark:border-stone-700 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-stone-900 dark:text-stone-100">{order.orderNumber}</span>
                          <span className="font-bold text-brand-800 dark:text-brand-300">{pkr(order.total)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={order.status} fulfillmentType={order.fulfillmentType} />
                          <span className="text-xs text-stone-500">{formatWhen(order.createdAt)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {isAdmin && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Internal notes</h3>
                  <form onSubmit={submitNotes} className="mt-2 space-y-2">
                    <textarea
                      className="input min-h-24 w-full resize-y dark:bg-stone-950 dark:border-stone-700"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Staff-only notes about this customer…"
                    />
                    {notesMsg && <p className="text-xs text-stone-500">{notesMsg}</p>}
                    <button type="submit" className="btn-primary" disabled={savingNotes}>
                      {savingNotes ? "Saving…" : "Save notes"}
                    </button>
                  </form>
                </section>
              )}

              {isAdmin && (
                <section className="border-t border-stone-100 pt-4 dark:border-stone-800">
                  {!blocked ? (
                    <button
                      type="button"
                      onClick={onBlock}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <Ban size={16} /> Block from ordering
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onUnblock}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                    >
                      <ShieldOff size={16} /> Unblock customer
                    </button>
                  )}
                </section>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );

  return createPortal(sheet, document.body);
}
