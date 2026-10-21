"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { AdminCustomer } from "@/lib/admin-types";
import {
  downloadCustomersCsv,
  fetchCustomersPage,
  type CustomerSegmentFilter,
  type CustomerSort,
} from "@/lib/admin-customers";
import { SEGMENT_FILTER_OPTIONS } from "@/lib/customer-segments";
import { usePoll } from "@/hooks/usePoll";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { CustomerTable } from "@/components/admin/CustomerTable";
import { BlockCustomerSheet } from "@/components/admin/BlockCustomerSheet";
import { CustomerDetailSheet } from "@/components/admin/CustomerDetailSheet";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import {
  AdminAlert,
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiCard,
  AdminKpiGrid,
  AdminPage,
  AdminPageHeader,
  SearchField,
  Segment,
} from "@/components/admin/ui";

type SortKey = CustomerSort;

type OrderBlock = {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string;
  createdAt: string;
};

function phoneKey(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function findContactBlock(blocks: OrderBlock[], email: string, phone: string | null) {
  const emailKey = email.trim().toLowerCase();
  const pKey = phoneKey(phone);
  return blocks.find(
    (b) => (b.email && b.email === emailKey) || (b.phone && pKey && b.phone === pKey)
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("spent");
  const [segment, setSegment] = useState<CustomerSegmentFilter>("all");
  const [page, setPage] = useState(1);
  const [blocks, setBlocks] = useState<OrderBlock[]>([]);
  const [actionMsg, setActionMsg] = useState("");
  const [blockTarget, setBlockTarget] = useState<AdminCustomer | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<AdminCustomer | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminCustomer | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [blockError, setBlockError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, segment]);

  const load = useCallback(
    () =>
      fetchCustomersPage({
        limit: PAGE_SIZE.table,
        offset: (page - 1) * PAGE_SIZE.table,
        search,
        sort,
        segment,
      }),
    [page, search, sort, segment]
  );

  const { data, loading, refreshing, error, refresh } = usePoll(load, 30000);
  const showSkeleton = loading && !data;

  const loadBlocks = useCallback(() => api<OrderBlock[]>("/admin/blocks"), []);

  useEffect(() => {
    if (!isAdmin) return;
    loadBlocks().then(setBlocks).catch(() => setBlocks([]));
  }, [loadBlocks, isAdmin]);

  function blockCustomer(c: AdminCustomer) {
    setBlockError("");
    setBlockTarget(c);
  }

  async function confirmBlock(reason: string) {
    if (!blockTarget) return;
    setBlocking(true);
    setBlockError("");
    setActionMsg("");
    try {
      await api("/admin/blocks", {
        method: "POST",
        body: JSON.stringify({ email: blockTarget.email, phone: blockTarget.phone, reason }),
      });
      setBlocks(await loadBlocks());
      setActionMsg(`${blockTarget.name} blocked from placing orders.`);
      setBlockTarget(null);
      refresh();
    } catch (err) {
      setBlockError(err instanceof Error ? err.message : "Could not block customer.");
    } finally {
      setBlocking(false);
    }
  }

  function unblockCustomer(c: AdminCustomer) {
    setUnblockTarget(c);
  }

  async function confirmUnblock() {
    if (!unblockTarget) return;
    const block = findContactBlock(blocks, unblockTarget.email, unblockTarget.phone ?? null);
    if (!block) return;
    setUnblocking(true);
    setActionMsg("");
    try {
      await api(`/admin/blocks/${block.id}`, { method: "DELETE" });
      setBlocks(await loadBlocks());
      setActionMsg(`${unblockTarget.name} can order again.`);
      setUnblockTarget(null);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Could not unblock customer.");
    } finally {
      setUnblocking(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadCustomersCsv({ search, sort, segment });
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;
  const stats = data?.stats ?? {
    count: 0,
    totalRevenue: 0,
    totalOrders: 0,
    avgSpend: 0,
    avgOrderValue: 0,
    repeatRate: 0,
  };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.table));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE.table + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE.table, total);

  const isCustomerBlocked = useCallback(
    (c: AdminCustomer) => Boolean(findContactBlock(blocks, c.email, c.phone ?? null)),
    [blocks]
  );

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Customers"
        description="Registered accounts and guest checkout — order history and lifetime value"
        icon={Users}
        iconAccent="sky"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              <Download size={16} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <RefreshButton busy={loading || refreshing} onClick={refresh} />
          </div>
        }
      />

      <AdminKpiGrid>
        <AdminKpiCard
          label="Total customers"
          value={stats.count}
          hint={`${stats.totalOrders} orders placed`}
          icon={Users}
          accent="sky"
        />
        <AdminKpiCard
          label="Lifetime revenue"
          value={pkr(stats.totalRevenue)}
          hint="Excludes cancelled"
          icon={Wallet}
          accent="brand"
        />
        <AdminKpiCard
          label="Avg lifetime value"
          value={pkr(Math.round(stats.avgSpend))}
          hint={
            stats.avgOrderValue
              ? `Avg order value ${pkr(Math.round(stats.avgOrderValue))}`
              : "Total spend ÷ customers"
          }
          icon={TrendingUp}
          accent="emerald"
        />
        <AdminKpiCard
          label="Repeat rate"
          value={`${stats.repeatRate}%`}
          hint="Customers with 2+ orders"
          icon={ShoppingBag}
          accent="violet"
        />
      </AdminKpiGrid>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {actionMsg && <AdminAlert variant="info">{actionMsg}</AdminAlert>}

      <AdminFilterBar className="lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name, email or phone…"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Segment
            value={segment}
            onChange={setSegment}
            options={SEGMENT_FILTER_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          />
          <Segment
            value={sort}
            onChange={setSort}
            options={[
              { id: "spent", label: "Top spenders" },
              { id: "orders", label: "Most orders" },
              { id: "recent", label: "Newest" },
              { id: "name", label: "A–Z" },
            ]}
          />
        </div>
      </AdminFilterBar>

      {showSkeleton ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : total === 0 ? (
        <AdminEmptyState
          icon={Users}
          title={search || segment !== "all" ? "No customers match your filters" : "No customers yet"}
          description={
            search || segment !== "all"
              ? "Try a different search or segment."
              : "Customers appear here after they place an order."
          }
        />
      ) : (
        <>
          <CustomerTable
            customers={customers}
            topSpenderId={stats.topSpenderId}
            sortBySpent={sort === "spent"}
            isBlocked={isCustomerBlocked}
            isAdmin={isAdmin}
            onBlock={blockCustomer}
            onUnblock={unblockCustomer}
            onOpenCustomer={setDetailTarget}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
          />
        </>
      )}

      <BlockCustomerSheet
        customer={blockTarget}
        saving={blocking}
        error={blockError}
        onClose={() => {
          if (!blocking) setBlockTarget(null);
        }}
        onConfirm={confirmBlock}
      />

      <ConfirmSheet
        open={Boolean(unblockTarget)}
        title={`Unblock ${unblockTarget?.name ?? "customer"}?`}
        message="They will be able to place orders again immediately."
        confirmLabel="Unblock"
        saving={unblocking}
        onClose={() => {
          if (!unblocking) setUnblockTarget(null);
        }}
        onConfirm={confirmUnblock}
      />

      <CustomerDetailSheet
        customer={detailTarget}
        isAdmin={isAdmin}
        blocked={detailTarget ? isCustomerBlocked(detailTarget) : false}
        onClose={() => setDetailTarget(null)}
        onBlock={() => {
          if (detailTarget) blockCustomer(detailTarget);
        }}
        onUnblock={() => {
          if (detailTarget) unblockCustomer(detailTarget);
        }}
      />
    </AdminPage>
  );
}
