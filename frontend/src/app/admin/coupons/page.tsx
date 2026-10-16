"use client";

import { FormEvent, useCallback, useState } from "react";
import { Tag } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminSurface, AdminAlert } from "@/components/admin/ui";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { usePoll } from "@/hooks/usePoll";
import { api } from "@/lib/api";
import { pkr } from "@/lib/format";

type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number | string;
  minSubtotal: number | string;
  usedCount: number;
  usageLimit: number | null;
  isActive: boolean;
};

export default function AdminCouponsPage() {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api<{ coupons: CouponRow[] }>("/admin/coupons"), []);
  const { data, loading, refreshing, refresh } = usePoll(load, 15000);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code,
          type,
          value: Number(value),
          minSubtotal: Number(minSubtotal) || 0,
        }),
      });
      setCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create coupon.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: CouponRow) {
    await api(`/admin/coupons/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    await refresh();
  }

  const coupons = data?.coupons ?? [];

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Promo codes"
        description="Coupons apply at online checkout (subtotal-based)."
        icon={Tag}
        iconAccent="violet"
        actions={<RefreshButton busy={loading || refreshing} onClick={refresh} />}
      />
      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      <AdminSurface>
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Code</span>
            <input className="input mt-1 font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Type</span>
            <select className="input mt-1" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}>
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Value</span>
            <input type="number" min={1} className="input mt-1 w-24" value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase text-stone-500">Min subtotal</span>
            <input type="number" min={0} className="input mt-1 w-28" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>Create</button>
        </form>
        <ul className="mt-6 divide-y divide-stone-100">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-mono font-bold">{c.code}</p>
                <p className="text-xs text-stone-500">
                  {c.type === "PERCENT" ? `${c.value}%` : pkr(c.value)} · min {pkr(c.minSubtotal)} · used {c.usedCount}
                  {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                </p>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={() => toggleActive(c)}>
                {c.isActive ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      </AdminSurface>
    </AdminPage>
  );
}
