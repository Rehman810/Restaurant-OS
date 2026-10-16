"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import type { Order } from "@/lib/types";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";

export default function SyncConflictsPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ orders: Order[] }>("/pos/sync-conflicts");
      setOrders(data.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Sync conflicts" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="POS sync conflicts"
        description="Orders synced from offline POS that need review before you trust totals or items."
      />
      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : orders.length === 0 ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title="No conflicts"
          description="All offline orders matched server pricing and availability."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-50">
                    {o.orderNumber}
                    {o.offlineLabel && (
                      <span className="ml-2 text-sm font-medium text-amber-800">({o.offlineLabel})</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">Device: {o.offlineDeviceLabel || "—"}</p>
                </div>
                <p className="text-lg font-black tabular-nums text-brand-700">{pkr(o.total)}</p>
              </div>
              {o.needsReviewReason && (
                <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">{o.needsReviewReason}</p>
              )}
              <Link href={`/admin/orders?highlight=${o.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700">
                Open in orders →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
