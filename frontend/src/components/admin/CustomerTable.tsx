"use client";

import { Crown, Mail, MessageCircle, Phone, Copy } from "lucide-react";
import { AdminCustomer } from "@/lib/admin-types";
import { SEGMENT_LABELS } from "@/lib/customer-segments";
import { formatDateShort, formatRelativeDays, formatWhen, pkr } from "@/lib/format";
import { pkPhoneForWhatsApp } from "@/lib/phone";
import { StatusBadge } from "./StatusBadge";
import { CustomerRowMenu } from "./CustomerRowMenu";

const AVATAR_GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function avatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[hash];
}

function segmentClass(segment: AdminCustomer["segment"]) {
  if (segment === "vip") return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200";
  if (segment === "at_risk") return "bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-200";
  if (segment === "lapsed") return "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-200";
  if (segment === "regular") return "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200";
  if (segment === "new") return "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200";
  return "";
}

export function CustomerTable({
  customers,
  topSpenderId,
  sortBySpent,
  isBlocked,
  isAdmin,
  onBlock,
  onUnblock,
  onOpenCustomer,
}: {
  customers: AdminCustomer[];
  topSpenderId?: string;
  sortBySpent: boolean;
  isBlocked: (customer: AdminCustomer) => boolean;
  isAdmin: boolean;
  onBlock: (customer: AdminCustomer) => void;
  onUnblock: (customer: AdminCustomer) => void;
  onOpenCustomer: (customer: AdminCustomer) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1040px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[4%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:border-stone-800 dark:bg-stone-900/80">
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Since</th>
              <th className="px-4 py-3 text-center font-semibold">Orders</th>
              <th className="px-4 py-3 text-right font-semibold">Spent</th>
              <th className="px-4 py-3 text-right font-semibold">Avg order</th>
              <th className="px-4 py-3 font-semibold">Last order</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const avgOrder = c.orderCount > 0 ? c.totalSpent / c.orderCount : 0;
              const blocked = isBlocked(c);
              const isTop = sortBySpent && topSpenderId === c.id && c.totalSpent > 0;
              const wa = c.phone ? pkPhoneForWhatsApp(c.phone) : null;
              const sinceLabel = c.joinedSource === "first_order" ? "First order" : "Joined";

              return (
                <tr
                  key={c.id}
                  onClick={() => onOpenCustomer(c)}
                  className={`cursor-pointer border-b border-stone-100 last:border-0 transition hover:bg-sky-50/40 dark:border-stone-800 dark:hover:bg-sky-950/20 ${
                    blocked ? "bg-red-50/30 dark:bg-red-950/20" : isTop ? "bg-amber-50/20 dark:bg-amber-950/15" : ""
                  }`}
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${avatarGradient(c.id)}`}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 dark:text-stone-50">{c.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {blocked && (
                            <span className="inline-flex rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-800">
                              Blocked
                            </span>
                          )}
                          {c.isGuest ? (
                            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-600 ring-1 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600">
                              Guest
                            </span>
                          ) : (
                            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-800 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-200 dark:ring-brand-800">
                              Registered
                            </span>
                          )}
                          {c.segment && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${segmentClass(c.segment)}`}
                            >
                              {SEGMENT_LABELS[c.segment]}
                            </span>
                          )}
                          {isTop && !blocked && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200">
                              <Crown size={9} /> Top
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                    {c.email ? (
                      <p className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
                        <Mail size={12} className="shrink-0 text-stone-400" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                    {c.phone ? (
                      <div className="mt-1 flex items-center gap-1">
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
                          <Phone size={12} className="shrink-0 text-stone-400" />
                          <span className="truncate">{c.phone}</span>
                        </p>
                        <div className="flex shrink-0 gap-0.5">
                          {wa && (
                            <a
                              href={`https://wa.me/${wa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="WhatsApp"
                              className="grid h-7 w-7 place-items-center rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            >
                              <MessageCircle size={14} />
                            </a>
                          )}
                          <a
                            href={`tel:${c.phone}`}
                            aria-label="Call"
                            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                          >
                            <Phone size={14} />
                          </a>
                          <button
                            type="button"
                            aria-label="Copy phone"
                            onClick={() => navigator.clipboard.writeText(c.phone!)}
                            className="grid h-7 w-7 place-items-center rounded-md text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-stone-500 dark:text-stone-400">
                    <span title={sinceLabel}>{formatWhen(c.createdAt)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center align-middle font-semibold text-stone-800 dark:text-stone-100">
                    {c.orderCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-bold text-brand-800 dark:text-brand-300">
                    {pkr(c.totalSpent)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle text-stone-700 dark:text-stone-300">
                    {c.orderCount > 0 ? pkr(Math.round(avgOrder)) : "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {c.lastOrder ? (
                      <div className="block w-full text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={c.lastOrder.status}
                            fulfillmentType={c.lastOrder.fulfillmentType}
                          />
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            {pkr(c.lastOrder.total)}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-[11px] text-stone-400"
                          title={formatDateShort(c.lastOrder.createdAt)}
                        >
                          {formatRelativeDays(c.lastOrder.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">No orders</span>
                    )}
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <CustomerRowMenu
                      isAdmin={isAdmin}
                      blocked={blocked}
                      onBlock={() => onBlock(c)}
                      onUnblock={() => onUnblock(c)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
