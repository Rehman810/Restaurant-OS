"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { AlertCircle, Check, Plus } from "lucide-react";
import type { FloorTable, ReservationRow } from "@/modules/dine-in/api";
import {
  formatBookingTime,
  formatTimeShort,
  graceEndIso,
  holdProgress,
  isToday,
  minutesUntilStart,
  timingBadge,
} from "@/modules/dine-in/booking-ui";
import { resendReservationEmail } from "@/modules/dine-in/api";

export function DineInBookingsPanel({
  reservations,
  tables,
  graceMin,
  nowMs,
  loading,
  historyView,
  isManager,
  onToggleHistory,
  onNewBooking,
  onConfirm,
  onReject,
  onCancel,
  onNoShow,
  onAssignTable,
  onSeatNow,
  onChangeSeat,
}: {
  reservations: ReservationRow[];
  tables: FloorTable[];
  graceMin: number;
  nowMs: number;
  loading: boolean;
  historyView: boolean;
  isManager: boolean;
  onToggleHistory: () => void;
  onNewBooking: () => void;
  onConfirm: (id: string, tableId?: string) => void;
  onReject: (id: string, reason?: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onAssignTable: (id: string, tableId: string | null) => void;
  onSeatNow: (r: ReservationRow) => void;
  onChangeSeat: (r: ReservationRow) => void;
}) {
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectSaving, setRejectSaving] = useState(false);

  const rejectSheet = (
    <ConfirmSheet
      open={rejectId !== null}
      title="Reject booking?"
      message="The guest will not be seated for this reservation."
      confirmLabel="Reject"
      danger
      reasonLabel="Reason (optional)"
      reasonPlaceholder="e.g. Fully booked"
      saving={rejectSaving}
      onClose={() => !rejectSaving && setRejectId(null)}
      onConfirm={(reason) => {
        if (!rejectId) return;
        setRejectSaving(true);
        Promise.resolve(onReject(rejectId, reason?.trim() || undefined))
          .finally(() => {
            setRejectSaving(false);
            setRejectId(null);
          });
      }}
    />
  );

  const pending = reservations.filter((r) => r.status === "PENDING");
  const confirmed = reservations.filter((r) => r.status === "CONFIRMED" && isToday(r.startsAt || r.reservedAt));
  const history = reservations.filter((r) => !["PENDING", "CONFIRMED"].includes(r.status));

  if (historyView) {
    return (
      <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-500">Seated, completed, cancelled, no-show, and rejected.</p>
          <button type="button" className="btn-ghost text-sm" onClick={onToggleHistory}>Back to active</button>
        </div>
        <BookingCardList rows={history} empty="No history in this range." />
      </div>
      {rejectSheet}
      </>
    );
  }

  return (
    <>
    <div className="space-y-8">
      <div className="flex justify-end">
        <button type="button" onClick={onNewBooking} className="btn-primary text-sm">
          <Plus size={16} /> New booking
        </button>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">Waiting for your confirmation</h2>
          <p className="mt-1 text-sm text-stone-500">
            Guests are told their request is not confirmed yet. If a request is still pending at its booking time, it expires and the guest gets an email.
          </p>
        </div>
        {pending.length === 0 && !loading && (
          <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-500">No pending requests.</p>
        )}
        {pending.map((r) => (
          <article key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-[140px]">
                <p className="font-bold text-stone-900 dark:text-stone-50">{r.guestName || r.customerName}</p>
                <p className="text-sm text-stone-500">{r.partySize} guests</p>
                <p className="text-xs text-stone-400">{r.guestEmail || r.customerEmail || "—"}</p>
              </div>
              <div className="text-sm text-stone-600">
                <p className="font-medium">{formatBookingTime(r.startsAt || r.reservedAt)}</p>
                <p className="text-xs text-stone-400">
                  Requested {Math.max(1, Math.round((nowMs - new Date(r.createdAt).getTime()) / 60_000))} min ago
                </p>
              </div>
              {isManager && (
                <label className="text-xs font-medium text-stone-500">
                  Seat for this booking
                  <select
                    className="input mt-1 min-w-[160px]"
                    value={r.tableId || ""}
                    onChange={(e) => onAssignTable(r.id, e.target.value || null)}
                  >
                    <option value="">Choose a seat</option>
                    {tables
                      .filter((t) => t.capacity >= r.partySize)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.zone} · {t.label}</option>
                      ))}
                  </select>
                </label>
              )}
              {isManager && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
                    onClick={() => onConfirm(r.id, r.tableId || undefined)}
                  >
                    Confirm booking
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold dark:border-stone-600"
                    onClick={() => setRejectId(r.id)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">Confirmed for today</h2>
          <p className="mt-1 text-sm text-stone-500">
            The bar shows how much of the {graceMin}-minute hold has been used. When it runs out, the booking is marked as a no-show and the seat is released.
          </p>
        </div>
        {confirmed.length === 0 && !loading && (
          <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-500">No confirmed bookings today.</p>
        )}
        {confirmed.map((r) => {
          const badge = timingBadge(r.startsAt || r.reservedAt, graceMin, nowMs);
          const hold = holdProgress(r.startsAt || r.reservedAt, graceMin, nowMs);
          const canSeat = minutesUntilStart(r.startsAt || r.reservedAt, nowMs) >= -15;
          const emailSent = r.email?.logs?.find((l) => l.type === "BOOKING_CONFIRMED" && l.status === "SENT");
          return (
            <article key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-50">{r.guestName || r.customerName}</p>
                  <p className="text-sm text-stone-500">{r.partySize} guests</p>
                  {r.table ? (
                    <p className="text-sm text-stone-600">table {r.table.label}</p>
                  ) : (
                    <select
                      className="input mt-2 max-w-xs text-sm"
                      value=""
                      onChange={(e) => e.target.value && onAssignTable(r.id, e.target.value)}
                    >
                      <option value="">Choose a seat</option>
                      {tables.filter((t) => t.capacity >= r.partySize).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="min-w-[200px] flex-1 max-w-md">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{formatTimeShort(r.startsAt || r.reservedAt)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        badge.tone === "late" ? "bg-amber-100 text-amber-900" : badge.tone === "due" ? "bg-indigo-100 text-indigo-900" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full transition-all ${hold.phase === "during" ? "bg-amber-400" : "bg-stone-200"}`}
                      style={{ width: `${hold.pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {hold.phase === "before"
                      ? `Seating opens at ${formatTimeShort(r.startsAt || r.reservedAt)}`
                      : `Seat held until ${formatTimeShort(graceEndIso(r.startsAt || r.reservedAt, graceMin))}`}
                  </p>
                </div>
                <div className="text-xs text-stone-500">
                  {r.email?.hasFailed ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle size={14} /> Email did not send
                      {r.email.lastFailedId && isManager && (
                        <button
                          type="button"
                          className="ml-1 rounded border border-red-200 px-2 py-0.5 text-[10px] font-bold"
                          onClick={() => void resendReservationEmail(r.id, r.email!.lastFailedId!)}
                        >
                          Resend email
                        </button>
                      )}
                    </span>
                  ) : emailSent ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Check size={14} /> Confirmation sent
                    </span>
                  ) : (
                    <span>Confirmation pending email</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    disabled={!canSeat || (!r.tableId && !tables.some((t) => t.status === "AVAILABLE" && t.capacity >= r.partySize))}
                    className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-900"
                    onClick={() => onSeatNow(r)}
                  >
                    Seat now
                  </button>
                  <button type="button" className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold" onClick={() => onChangeSeat(r)}>
                    Change seat
                  </button>
                  <button type="button" className="text-sm font-semibold text-red-600" onClick={() => onCancel(r.id)}>Cancel</button>
                  <button type="button" className="text-sm font-semibold text-amber-800" onClick={() => onNoShow(r.id)}>No-show</button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <button type="button" onClick={onToggleHistory} className="w-full rounded-2xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-900">
        Show history: seated, completed, cancelled, no-show
      </button>
      <p className="text-center text-xs text-stone-400">
        Public booking page: <Link href="/book" className="text-brand-600 underline">/book</Link>
      </p>
    </div>
    {rejectSheet}
    </>
  );
}

function BookingCardList({ rows, empty }: { rows: ReservationRow[]; empty: string }) {
  if (!rows.length) return <p className="text-center text-sm text-stone-500 py-8">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-900">
          <span className="font-semibold">{r.guestName || r.customerName}</span>
          <span className="text-stone-400"> · {r.status} · {formatBookingTime(r.startsAt || r.reservedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
