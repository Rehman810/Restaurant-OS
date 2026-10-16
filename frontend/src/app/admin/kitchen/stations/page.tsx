"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Flame, Plus, Trash2 } from "lucide-react";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  AdminSurface,
} from "@/components/admin/ui";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { usePoll } from "@/hooks/usePoll";
import {
  createPrintStation,
  deletePrintStation,
  fetchPrintStations,
  updatePrintStation,
} from "@/lib/admin-print-stations";

export default function PrintStationsPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => fetchPrintStations(), []);
  const { data, loading, refreshing, refresh } = usePoll(load, 15000);
  const stations = data?.stations ?? [];

  async function addStation(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await createPrintStation({ name: name.trim(), code: code.trim() || name.trim() });
      setName("");
      setCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add station.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDefault(id: string) {
    setBusy(true);
    try {
      await updatePrintStation(id, { isDefault: true });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update station.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this print station?")) return;
    setBusy(true);
    try {
      await deletePrintStation(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete station.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Print stations"
        description="Route menu items to grill, bar, or dessert printers. KOT tickets split by station."
        icon={Flame}
        iconAccent="brand"
        actions={
          <div className="flex gap-2">
            <Link href="/admin/kitchen" className="btn-secondary text-sm">Kitchen board</Link>
            <RefreshButton busy={loading || refreshing} onClick={refresh} />
          </div>
        }
      />

      <AdminAlert variant="info">
        Assign stations on each dish under <Link href="/admin/menu" className="font-semibold underline">Menu</Link>.
        Unassigned items print to the default station.
      </AdminAlert>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      <AdminSurface>
        <form onSubmit={addStation} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Name</span>
            <input className="input mt-1 block min-w-[160px]" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Code</span>
            <input className="input mt-1 block w-28 font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="GRILL" />
          </label>
          <button type="submit" className="btn-primary inline-flex items-center gap-1.5" disabled={busy}>
            <Plus size={16} /> Add
          </button>
        </form>

        <ul className="mt-6 divide-y divide-stone-100">
          {stations.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-stone-900">
                  {s.name}{" "}
                  <span className="font-mono text-xs text-stone-500">{s.code}</span>
                  {s.isDefault && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">Default</span>
                  )}
                </p>
                <p className="text-xs text-stone-500">Sort {s.sortOrder} · {s.isActive ? "Active" : "Off"}</p>
              </div>
              <div className="flex gap-2">
                {!s.isDefault && (
                  <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => toggleDefault(s.id)}>
                    Make default
                  </button>
                )}
                {!s.isDefault && (
                  <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" disabled={busy} onClick={() => remove(s.id)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!loading && stations.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-500">No stations for this branch yet.</p>
        )}
      </AdminSurface>
    </AdminPage>
  );
}
