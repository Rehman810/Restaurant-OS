"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  Plus,
  Printer,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
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
  type PrintStation,
} from "@/lib/admin-print-stations";

const STATION_ACCENTS = [
  "from-orange-500/15 to-amber-500/5 ring-orange-200/80 dark:ring-orange-800/50",
  "from-sky-500/15 to-blue-500/5 ring-sky-200/80 dark:ring-sky-800/50",
  "from-emerald-500/15 to-teal-500/5 ring-emerald-200/80 dark:ring-emerald-800/50",
  "from-violet-500/15 to-purple-500/5 ring-violet-200/80 dark:ring-violet-800/50",
];

function StationCard({
  station,
  accent,
  busy,
  onDefault,
  onDelete,
}: {
  station: PrintStation;
  accent: string;
  busy: boolean;
  onDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 ring-1 ${accent} ${
        station.isDefault ? "ring-2 ring-brand-400 dark:ring-brand-600" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-lg bg-white/90 px-2.5 py-1 font-mono text-sm font-bold uppercase tracking-wide text-stone-800 shadow-sm dark:bg-stone-900/90 dark:text-stone-100">
              {station.code}
            </span>
            {station.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                <Star size={10} fill="currentColor" /> Default
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-lg font-bold text-stone-900 dark:text-stone-50">{station.name}</p>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            {station.isActive ? "Active on kitchen & KOT" : "Inactive"}
            {station.sortOrder > 0 ? ` · Sort ${station.sortOrder}` : ""}
          </p>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/80 text-stone-700 shadow-sm dark:bg-stone-900/80 dark:text-stone-200">
          <Printer size={20} />
        </div>
      </div>

      {!station.isDefault ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-200/60 pt-3 dark:border-stone-600/40">
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-stone-800 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-60 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600 dark:hover:bg-stone-700"
            disabled={busy}
            onClick={onDefault}
          >
            Set as default
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      ) : (
        <p className="mt-3 border-t border-stone-200/60 pt-3 text-xs text-stone-600 dark:border-stone-600/40 dark:text-stone-400">
          Menu items without a station print here.
        </p>
      )}
    </div>
  );
}

export default function PrintStationsPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => fetchPrintStations(), []);
  const { data, loading, refreshing, refresh } = usePoll(load, 15000);
  const stations = data?.stations ?? [];

  const sorted = useMemo(
    () => [...stations].sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1) || a.name.localeCompare(b.name)),
    [stations]
  );

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
        description="Split KOT tickets and kitchen screens by grill, bar, drinks, or packing."
        icon={Printer}
        iconAccent="brand"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/kitchen"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <ChefHat size={16} /> Kitchen board
            </Link>
            <RefreshButton busy={loading || refreshing} onClick={refresh} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { step: "1", title: "Create stations", text: "Grill, fryer, drinks — one per printer or tablet." },
          { step: "2", title: "Link menu items", text: "Each dish picks a station in Menu." },
          { step: "3", title: "Run kitchen", text: "KOT splits automatically; filter the board by station." },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-2xl border border-stone-200/80 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              {item.step}
            </span>
            <p className="mt-2 font-semibold text-stone-900 dark:text-stone-50">{item.title}</p>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{item.text}</p>
          </div>
        ))}
      </div>

      <Link
        href="/admin/menu"
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-3 text-sm font-semibold text-brand-900 transition hover:bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-100 dark:hover:bg-brand-950/50"
      >
        <span className="inline-flex items-center gap-2">
          <UtensilsCrossed size={18} />
          Assign stations on each menu item
        </span>
        <ArrowRight size={16} />
      </Link>

      {error && <AdminAlert variant="error">{error}</AdminAlert>}

      <AdminSurface className="space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Add station</h2>
          <form onSubmit={addStation} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Display name</span>
              <input
                className="input mt-1.5 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Grill"
                required
              />
            </label>
            <label className="sm:w-36 text-sm">
              <span className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">Short code</span>
              <input
                className="input mt-1.5 w-full font-mono uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GRILL"
                maxLength={12}
              />
            </label>
            <button type="submit" className="btn-primary inline-flex h-[42px] items-center justify-center gap-2 px-5" disabled={busy}>
              <Plus size={18} /> Add station
            </button>
          </form>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Your stations
            </h2>
            {!loading && (
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{sorted.length} total</span>
            )}
          </div>

          {loading && !data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="skeleton h-36 rounded-2xl" />
              <div className="skeleton h-36 rounded-2xl" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 py-12 text-center dark:border-stone-700 dark:bg-stone-900/50">
              <Printer className="mx-auto text-stone-300 dark:text-stone-600" size={32} />
              <p className="mt-3 font-semibold text-stone-700 dark:text-stone-200">No stations yet</p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Add Grill and Drinks above — then link items in Menu.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((s, i) => (
                <StationCard
                  key={s.id}
                  station={s}
                  accent={STATION_ACCENTS[i % STATION_ACCENTS.length]}
                  busy={busy}
                  onDefault={() => void toggleDefault(s.id)}
                  onDelete={() => void remove(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </AdminSurface>
    </AdminPage>
  );
}
