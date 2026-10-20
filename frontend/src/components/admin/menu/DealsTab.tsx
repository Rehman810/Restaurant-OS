"use client";

import Image from "next/image";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImageIcon, Pencil, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import { pkr } from "@/lib/format";
import { dealCategoryLabel, mergeDealCategoryOptions } from "@/lib/deal-categories";
import {
  fetchAdminDeals,
  patchDealAvailability,
  patchDealVisibility,
} from "@/lib/admin-menu/api";
import type { AdminDealRow } from "@/lib/admin-menu/types";
import { parseDealStatusParams } from "@/lib/admin-menu/filters-url";
import { channelSummary, dealScheduleStatusLabel } from "@/lib/admin-menu/deal-schedule-label";
import { AdminEmptyState } from "@/components/admin/ui";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { CatalogViewToggle, parseCatalogView } from "@/modules/catalog/CatalogViewToggle";
import { Pagination } from "@/components/Pagination";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { DishAvailabilityToggle } from "./DishAvailabilityToggle";
import { DishVisibilityToggle } from "./DishVisibilityToggle";
import { DishAvailabilitySheet } from "./DishAvailabilitySheet";
import { DealRowMenu } from "./DealRowMenu";

const PAGE_SIZE = 10;

type Props = {
  header?: ReactNode;
  canManage: boolean;
  canToggleAvailability: boolean;
  onAddDeal: () => void;
  onEditDeal: (id: string) => void;
  onDeleteDeal: (row: AdminDealRow) => void;
};

export function DealsTab({ header, canManage, canToggleAvailability, onAddDeal, onEditDeal, onDeleteDeal }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dq = searchParams.get("dq") || "";
  const dgroup = searchParams.get("dgroup") || "";
  const status = parseDealStatusParams(searchParams.get("dstatus"));
  const page = Math.max(1, Number(searchParams.get("dpage")) || 1);
  const view = parseCatalogView(searchParams.get("dview"));

  const [searchInput, setSearchInput] = useState(dq);
  const [rows, setRows] = useState<AdminDealRow[]>([]);
  const [counts, setCounts] = useState({ active: 0, scheduled: 0, expired: 0, hidden: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [availSheet, setAvailSheet] = useState<AdminDealRow | null>(null);

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") p.delete(k);
        else p.set(k, v);
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchInput !== dq) setQuery({ dq: searchInput || undefined, dpage: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput, dq, setQuery]);

  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await fetchAdminDeals({
          q: dq,
          group: dgroup || undefined,
          status: status.length ? status : undefined,
          page,
          pageSize: PAGE_SIZE,
        });
        setRows(res.rows);
        setCounts(res.counts);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not load deals.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dq, dgroup, status.join(","), page]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const groupSelectOptions = useMemo(() => {
    const labels = rows.map((r) => dealCategoryLabel(r.group));
    if (dgroup) labels.push(dgroup);
    return [
      { value: "", label: "All offer groups" },
      ...mergeDealCategoryOptions(labels).map((g) => ({ value: g, label: g })),
    ];
  }, [rows, dgroup]);

  async function applyAvailability(row: AdminDealRow, soldOut: boolean, patch?: Parameters<typeof patchDealAvailability>[1]) {
    try {
      if (!soldOut) await patchDealAvailability(row.id, { state: "available" });
      else if (patch) await patchDealAvailability(row.id, patch);
      else {
        setAvailSheet(row);
        return;
      }
      await load(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update availability.");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function dealCard(row: AdminDealRow) {
    return (
      <article key={row.id} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <div className="relative aspect-[16/10] bg-stone-100">
          {row.thumbnail ? (
            <Image src={row.thumbnail} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
          ) : (
            <div className="grid h-full place-items-center text-stone-400">
              <ImageIcon size={28} />
            </div>
          )}
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-700 shadow-sm">
            {pkr(row.dealPrice)}
          </span>
          {row.savings > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
              Save {pkr(row.savings)}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-stone-900 dark:text-stone-50">{row.title}</h3>
            <p className="text-xs text-stone-500">{dealCategoryLabel(row.group)}</p>
          </div>
          <p className="line-clamp-2 text-xs text-stone-600 dark:text-stone-400">
            {row.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
          </p>
          <p className="text-xs text-stone-500">
            <span className="font-medium text-stone-700 dark:text-stone-300">{dealScheduleStatusLabel(row.scheduleStatus)}</span>
            {" · "}
            {row.scheduleSummary}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
            <DishAvailabilityToggle
              availability={row.availability}
              disabled={!canToggleAvailability}
              onToggle={(sold) => void applyAvailability(row, sold)}
            />
            {canManage && (
              <DishVisibilityToggle
                visible={row.visibility === "visible"}
                onChange={(v) => void patchDealVisibility(row.id, v).then(() => load(true))}
              />
            )}
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => onEditDeal(row.id)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-stone-100 px-3 text-xs font-semibold dark:bg-stone-800"
                >
                  <Pencil size={14} /> Edit
                </button>
                <DealRowMenu onEdit={() => onEditDeal(row.id)} onDelete={() => onDeleteDeal(row)} />
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" aria-live="polite">
      <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">{header}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search offers…"
            className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm dark:border-stone-600 dark:bg-stone-900 xl:max-w-xs"
          />
          <AdminSelect
            value={dgroup}
            onChange={(v) => setQuery({ dgroup: v || undefined, dpage: "1" })}
            options={groupSelectOptions}
            aria-label="Offer group"
            minWidth="min-w-[11rem]"
            className="shrink-0"
          />
          <AdminSelect
            value={status[0] || ""}
            onChange={(v) => setQuery({ dstatus: v || undefined, dpage: "1" })}
            options={[
              { value: "", label: "All statuses" },
              { value: "active", label: `Active (${counts.active})` },
              { value: "scheduled", label: `Scheduled (${counts.scheduled})` },
              { value: "expired", label: `Expired (${counts.expired})` },
              { value: "hidden", label: `Hidden (${counts.hidden})` },
            ]}
            aria-label="Offer status"
            minWidth="min-w-[10.5rem]"
            className="shrink-0"
          />
          <CatalogViewToggle value={view} onChange={(v) => setQuery({ dview: v })} />
          <RefreshButton busy={refreshing} onClick={() => load(true)} showLabel={false} />
          {canManage && (
            <button type="button" onClick={onAddDeal} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">
              Create offer
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={Sparkles} title="No offers match" description="Adjust filters or create an offer." />
      ) : view === "list" ? (
        <div className={`overflow-x-auto rounded-2xl border border-stone-200/80 bg-white dark:border-stone-700 dark:bg-stone-900 ${refreshing ? "opacity-60" : ""}`}>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-100 text-xs uppercase text-stone-500 dark:border-stone-800">
              <tr>
                <th className="px-3 py-3">Offer</th>
                <th className="hidden px-3 py-3 md:table-cell">Group</th>
                <th className="px-3 py-3">Price</th>
                <th className="hidden px-3 py-3 lg:table-cell">Schedule</th>
                <th className="px-3 py-3">Availability</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-50 dark:border-stone-800">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-stone-900 dark:text-stone-50">{row.title}</p>
                    <p className="line-clamp-1 text-xs text-stone-500">{row.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                  </td>
                  <td className="hidden px-3 py-2 text-stone-600 md:table-cell">{dealCategoryLabel(row.group)}</td>
                  <td className="px-3 py-2 font-semibold text-brand-700">{pkr(row.dealPrice)}</td>
                  <td className="hidden px-3 py-2 text-xs text-stone-500 lg:table-cell">
                    {dealScheduleStatusLabel(row.scheduleStatus)} · {row.scheduleSummary}
                  </td>
                  <td className="px-3 py-2">
                    <DishAvailabilityToggle
                      availability={row.availability}
                      disabled={!canToggleAvailability}
                      onToggle={(sold) => void applyAvailability(row, sold)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage && (
                      <DealRowMenu onEdit={() => onEditDeal(row.id)} onDelete={() => onDeleteDeal(row)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${refreshing ? "opacity-60" : ""}`}>
          {rows.map((row) => dealCard(row))}
        </div>
      )}
      </div>

      {total > 0 ? (
        <div className="mt-auto shrink-0 border-t border-stone-200/80 bg-[#fffaf5] dark:border-stone-700 dark:bg-stone-950">
          <Pagination
            docked
            page={page}
            totalPages={totalPages}
            totalItems={total}
            rangeStart={(page - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(page * PAGE_SIZE, total)}
            onPageChange={(p) => setQuery({ dpage: String(p) })}
          />
        </div>
      ) : null}

      <DishAvailabilitySheet
        open={Boolean(availSheet)}
        dishName={availSheet?.title ?? ""}
        onClose={() => setAvailSheet(null)}
        canAllBranches={canManage}
        onApply={async (patch) => {
          if (availSheet) await applyAvailability(availSheet, true, patch);
        }}
      />
    </div>
  );
}
