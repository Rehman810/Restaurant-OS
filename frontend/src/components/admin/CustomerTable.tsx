"use client";

import { Ban, Crown, Mail, Phone } from "lucide-react";
import { AdminCustomer } from "@/lib/admin-types";
import { formatWhen, pkr } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

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

export function CustomerTable({
  customers,
  topSpenderId,
  sortBySpent,
  isBlocked,
  isAdmin,
  onBlock,
  onUnblock,
  onViewHistory,
}: {
  customers: AdminCustomer[];
  topSpenderId?: string;
  sortBySpent: boolean;
  isBlocked: (customer: AdminCustomer) => boolean;
  isAdmin: boolean;
  onBlock: (customer: AdminCustomer) => void;
  onUnblock: (customer: AdminCustomer) => void;
  onViewHistory: (customer: AdminCustomer) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            {isAdmin && <col className="w-[8%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 text-center font-semibold">Orders</th>
              <th className="px-4 py-3 text-right font-semibold">Spent</th>
              <th className="px-4 py-3 text-right font-semibold">Avg order</th>
              <th className="px-4 py-3 font-semibold">Last order</th>
              {isAdmin && <th className="px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const avgOrder = c.orderCount > 0 ? c.totalSpent / c.orderCount : 0;
              const blocked = isBlocked(c);
              const isTop = sortBySpent && topSpenderId === c.id && c.totalSpent > 0;

              return (
                <tr
                  key={c.id}
                  className={`border-b border-stone-100 last:border-0 transition hover:bg-sky-50/40 ${
                    blocked ? "bg-red-50/30" : isTop ? "bg-amber-50/20" : ""
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
                        <p className="font-semibold text-stone-900">{c.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {blocked && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200">
                              <Ban size={9} /> Blocked
                            </span>
                          )}
                          {c.isGuest && (
                            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-600 ring-1 ring-stone-200">
                              Guest
                            </span>
                          )}
                          {isTop && !blocked && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                              <Crown size={9} /> Top
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {c.email ? (
                      <p className="flex items-center gap-1.5 text-xs text-stone-600">
                        <Mail size={12} className="shrink-0 text-stone-400" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                    {c.phone ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
                        <Phone size={12} className="shrink-0 text-stone-400" />
                        <span className="truncate">{c.phone}</span>
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-stone-500">
                    {formatWhen(c.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center align-middle font-semibold text-stone-800">
                    <button
                      type="button"
                      onClick={() => onViewHistory(c)}
                      className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50 hover:underline"
                    >
                      {c.orderCount}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-bold text-brand-800">
                    {pkr(c.totalSpent)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-middle text-stone-700">
                    {c.orderCount > 0 ? pkr(Math.round(avgOrder)) : "—"}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {c.lastOrder ? (
                      <button
                        type="button"
                        onClick={() => onViewHistory(c)}
                        className="block w-full text-left hover:text-brand-700"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={c.lastOrder.status}
                            fulfillmentType={c.lastOrder.fulfillmentType}
                          />
                          <span className="text-xs font-bold text-stone-900">{pkr(c.lastOrder.total)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-400">{formatWhen(c.lastOrder.createdAt)}</p>
                      </button>
                    ) : (
                      <span className="text-xs text-stone-400">No orders</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-4 py-3 align-middle">
                      {!blocked ? (
                        <button
                          type="button"
                          onClick={() => onBlock(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          <Ban size={12} /> Block
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUnblock(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Unblock
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
