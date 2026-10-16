"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bike,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Truck,
  Users,
} from "lucide-react";
import { fetchRidersPage } from "@/lib/admin-riders";
import { pkr, formatWhen } from "@/lib/format";
import { usePoll } from "@/hooks/usePoll";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import {
  AdminAlert,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  AdminSurface,
  SearchField,
} from "@/components/admin/ui";

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-brand-500 to-orange-600",
];

function avatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[hash];
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function RidersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(
    () =>
      fetchRidersPage({
        limit: PAGE_SIZE.grid,
        offset: (page - 1) * PAGE_SIZE.grid,
        search,
      }),
    [page, search]
  );

  const { data, loading, refreshing, error, refresh } = usePoll(load, 10000);
  const showSkeleton = loading && !data;

  const stats = data?.stats ?? { total: 0, onRoad: 0, activeDrops: 0, delivered: 0, available: 0 };
  const riders = data?.riders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.grid));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE.grid + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE.grid, total);

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Riders"
        description="Fleet overview — live assignments and delivery stats"
        icon={Bike}
        iconAccent="violet"
        actions={<RefreshButton busy={loading || refreshing} onClick={refresh} />}
      />

      <AdminAlert variant="info">
        New rider accounts are created on{" "}
        <Link href="/admin/staff" className="font-semibold underline">
          Staff → Add staff member (Rider role)
        </Link>
        . This page is for monitoring deliveries and assigning orders.
      </AdminAlert>

      <AdminKpiGrid>
        <AdminKpiCard label="Fleet size" value={stats.total} hint="Registered riders" icon={Users} accent="violet" />
        <AdminKpiCard
          label="On delivery"
          value={stats.onRoad}
          hint={`${stats.activeDrops} active drop${stats.activeDrops === 1 ? "" : "s"}`}
          icon={Truck}
          accent="brand"
        />
        <AdminKpiCard
          label="Available"
          value={stats.available}
          hint="Ready for assignment"
          icon={CheckCircle2}
          accent="emerald"
        />
        <AdminKpiCard
          label="Total delivered"
          value={stats.delivered}
          hint="All-time completions"
          icon={Package}
          accent="sky"
        />
      </AdminKpiGrid>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      <AdminSurface>
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search riders by name, email or phone…"
        />
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Assign riders from the{" "}
          <Link href="/admin/orders" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Orders
          </Link>{" "}
          page when an order is ready to go out.
        </p>
      </AdminSurface>

      {showSkeleton ? (
        <div className="grid w-full gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <AdminEmptyState
          icon={Bike}
          title={search ? "No riders match your search" : "No riders yet"}
          action={
            !search ? (
              <Link href="/admin/staff" className="btn-primary inline-flex">
                Add rider via Staff
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid w-full gap-4">
            {riders.map((r) => {
              const busy = r.activeOrders.length > 0;
              return (
                <article
                  key={r.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                    busy ? "border-violet-200 ring-1 ring-violet-100" : "border-stone-200/80"
                  }`}
                >
                  <div className="flex items-center gap-4 border-b border-stone-100 p-4 sm:p-5">
                    <div
                      className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white shadow-sm ${avatarGradient(r.id)}`}
                    >
                      {initials(r.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-stone-900">{r.name}</h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            busy
                              ? "bg-violet-100 text-violet-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {busy ? "On delivery" : "Available"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-stone-500">{r.email}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                        <Phone size={12} /> {r.phone || "No phone"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{r.deliveredCount}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Delivered</p>
                      <p className="mt-1 text-xs text-stone-400">{r.totalAssigned} assigned</p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      <Package size={12} /> Active deliveries ({r.activeOrders.length})
                    </p>

                    {r.activeOrders.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-stone-200 bg-stone-50/80 py-8 text-center">
                        <Truck size={24} className="mx-auto text-stone-300" />
                        <p className="mt-2 text-sm text-stone-500">No active drops</p>
                        <p className="mt-0.5 text-xs text-stone-400">Assign from Orders when ready</p>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {r.activeOrders.map((o) => (
                          <li
                            key={o.id}
                            className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-3.5 dark:border-violet-800/50 dark:from-stone-800 dark:to-stone-900"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-bold text-stone-900">{o.orderNumber}</p>
                                  <FulfillmentBadge type={o.fulfillmentType} />
                                </div>
                                <p className="mt-0.5 text-xs text-stone-500">
                                  {formatWhen(o.createdAt)} · {pkr(o.total)}
                                </p>
                              </div>
                              <StatusBadge status={o.status} fulfillmentType={o.fulfillmentType} />
                            </div>
                            <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
                              <MapPin size={12} className="mt-0.5 shrink-0 text-violet-500" />
                              {o.deliveryAddress}
                            </p>
                            <p className="mt-1.5 text-xs font-medium text-stone-700">
                              {o.customerName} · {o.customerPhone}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
      )}
    </AdminPage>
  );
}
