"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bike, Download, Wallet } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminSurface, AdminAlert, AdminKpiGrid, AdminKpiCard } from "@/components/admin/ui";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { usePoll } from "@/hooks/usePoll";
import { pkr } from "@/lib/format";
import { downloadRiderCashCsv } from "@/lib/api";
import { fetchRiderCashLedger, fetchRiderCashSummary, settleRiderCash } from "@/lib/admin-rider-cash";
import { RiderCashLedgerEntry } from "@/lib/admin-types";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";

export default function RiderCashPage() {
  const [riderFilter, setRiderFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [settleOpen, setSettleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadSummary = useCallback(() => fetchRiderCashSummary(), []);
  const { data: summary, loading: sumLoading, refresh: refreshSummary } = usePoll(loadSummary, 12000);

  const loadLedger = useCallback(async () => {
    return fetchRiderCashLedger({
      status: "PENDING",
      riderId: riderFilter || undefined,
      limit: 100,
    });
  }, [riderFilter]);

  const { data: ledger, loading: ledgerLoading, refresh: refreshLedger } = usePoll(loadLedger, 12000);

  const entries = ledger?.entries ?? [];
  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected]
  );
  const selectedRiderId = selectedEntries[0]?.rider.id;
  const expectedSelected = selectedEntries.reduce((s, e) => s + Number(e.collectedAmount), 0);

  useEffect(() => {
    if (!selected.size) {
      setReceived("");
      return;
    }
    setReceived(String(Math.round(expectedSelected)));
  }, [expectedSelected, selected.size]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmSettle() {
    if (!selectedRiderId || !selected.size) return;
    const mixed = selectedEntries.some((e) => e.rider.id !== selectedRiderId);
    if (mixed) {
      setActionError("Select entries for one rider at a time.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await settleRiderCash({
        riderId: selectedRiderId,
        entryIds: [...selected],
        receivedAmount: Number(received),
        note: note.trim() || undefined,
      });
      setSelected(new Set());
      setSettleOpen(false);
      await Promise.all([refreshSummary(), refreshLedger()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Settlement failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Rider cash (COD)"
        description="Collect cash riders bring back from deliveries and post it to your open shift."
        icon={Wallet}
        iconAccent="emerald"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/riders" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <Bike size={16} /> Fleet
            </Link>
            <button type="button" className="btn-secondary inline-flex items-center gap-1.5 text-sm" onClick={() => downloadRiderCashCsv().catch(() => null)}>
              <Download size={16} /> CSV
            </button>
            <RefreshButton busy={sumLoading || ledgerLoading} onClick={() => { refreshSummary(); refreshLedger(); }} />
          </div>
        }
      />

      <AdminAlert variant="info">
        Settlement requires an <strong>open cash shift</strong> for your account at this branch (same as POS cash).
      </AdminAlert>

      {actionError && <AdminAlert variant="error">{actionError}</AdminAlert>}

      <AdminKpiGrid>
        <AdminKpiCard label="Pending with riders" value={pkr(summary?.totalPending ?? 0)} hint={`${summary?.pendingCount ?? 0} deliveries`} icon={Wallet} accent="emerald" />
        <AdminKpiCard
          label="Stale handovers"
          value={summary?.staleCount ?? 0}
          hint={`Older than ${summary?.staleHours ?? 24}h`}
          icon={Wallet}
          accent="brand"
        />
      </AdminKpiGrid>

      <AdminSurface>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Filter rider</span>
            <select className="input mt-1 min-w-[200px]" value={riderFilter} onChange={(e) => { setRiderFilter(e.target.value); setSelected(new Set()); }}>
              <option value="">All riders</option>
              {(summary?.riders ?? []).map((r) => (
                <option key={r.riderId} value={r.riderId}>
                  {r.name} ({pkr(r.pendingAmount)})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!selected.size}
            onClick={() => setSettleOpen(true)}
          >
            Settle {selected.size} selected
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-2" />
                <th className="py-2 pr-2">Order</th>
                <th className="py-2 pr-2">Rider</th>
                <th className="py-2 pr-2">Delivered</th>
                <th className="py-2 pr-2 text-right">Collected</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: RiderCashLedgerEntry) => (
                <tr key={e.id} className="border-b border-stone-100">
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                  </td>
                  <td className="py-2 pr-2 font-medium">{e.order.orderNumber}</td>
                  <td className="py-2 pr-2">{e.rider.name}</td>
                  <td className="py-2 pr-2 text-stone-500">{new Date(e.deliveredAt).toLocaleString()}</td>
                  <td className="py-2 pr-2 text-right font-semibold">{pkr(e.collectedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ledgerLoading && entries.length === 0 && (
            <p className="py-8 text-center text-sm text-stone-500">No pending rider cash for this branch.</p>
          )}
        </div>
      </AdminSurface>

      <ConfirmSheet
        open={settleOpen}
        title="Settle rider cash"
        message={
          <div className="space-y-3">
            <p>Expected from selected orders: {pkr(expectedSelected)}. Cash received posts to your open shift.</p>
            <label className="block text-sm">
              <span className="font-medium">Cash received (Rs)</span>
              <input type="number" min={0} className="input mt-1 w-full" value={received} onChange={(e) => setReceived(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Note (optional)</span>
              <input type="text" className="input mt-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        }
        confirmLabel="Confirm settlement"
        saving={busy}
        onClose={() => setSettleOpen(false)}
        onConfirm={() => confirmSettle()}
      />
    </AdminPage>
  );
}
