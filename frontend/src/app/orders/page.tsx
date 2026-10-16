"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";
import { OrderTrackForm } from "@/components/OrderTrackForm";
import { StatusTrack } from "@/components/StatusTrack";
import { Pagination } from "@/components/Pagination";
import { useAuth } from "@/lib/auth";
import { formatWhen, pkr } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/pagination";
import { fetchMyOrdersPage } from "@/lib/admin-orders";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { Order } from "@/lib/types";
import { ClipboardList, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { fillCartFromOrder } from "@/lib/reorder-from-order";
import { useLiveOrders } from "@/hooks/useLiveOrders";

export default function OrdersPage() {
  const router = useRouter();
  const addConfigured = useCart((s) => s.addConfigured);
  const addDeal = useCart((s) => s.addDeal);
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    fetchMyOrdersPage({ limit: PAGE_SIZE.list, offset: (page - 1) * PAGE_SIZE.list })
      .then((res) => {
        setOrders(res.orders);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load orders.");
        setOrders([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [user, page]);

  useEffect(() => {
    load();
  }, [load]);
  useLiveOrders(load);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.list));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE.list + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE.list, total);

  async function reorder(orderId: string) {
    const order = await api<Order>(`/orders/${orderId}`);
    await fillCartFromOrder(order, { addConfigured, addDeal });
    router.push("/checkout");
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 pb-28 sm:px-6 md:pb-16">
        <div className="space-y-2">
          <h1 className="font-display text-4xl">Orders</h1>
          <p className="text-sm text-stone-500">
            Track any order with your order number and phone. Sign in to see your full history.{" "}
            <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>

        <OrderTrackForm />

        {authLoading && user && <div className="skeleton h-40 rounded-3xl" />}

        {user && (
          <section className="space-y-4">
            <h2 className="font-display text-2xl text-stone-900">My orders</h2>
            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
            {loading && orders.length === 0 && <div className="skeleton h-40 rounded-3xl" />}
            {!loading && total === 0 && (
              <div className="card grid place-items-center px-6 py-16 text-center">
                <ClipboardList className="mb-3 text-brand-500" />
                <p className="font-display text-2xl">No orders yet</p>
                <p className="mt-1 text-sm text-stone-500">Your next order is one tap away.</p>
                <Link href="/menu" className="btn-primary mt-5">
                  Browse menu
                </Link>
              </div>
            )}
            <ul className="space-y-4">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="card block p-6 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{o.orderNumber}</p>
                        <FulfillmentBadge type={o.fulfillmentType} size="md" />
                      </div>
                      <p className="text-brand-700">{pkr(o.total)}</p>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">{formatWhen(o.createdAt)}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void reorder(o.id).catch(() => null);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
                    >
                      <RotateCcw size={14} /> Reorder
                    </button>
                    <div className="mt-5">
                      <StatusTrack status={o.status} fulfillmentType={o.fulfillmentType} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {total > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={setPage}
                className="mt-4"
              />
            )}
          </section>
        )}

        {!authLoading && !user && (
          <p className="text-center text-sm text-stone-500">
            Have an account?{" "}
            <Link href="/login?next=/orders" className="font-semibold text-brand-700 hover:underline">
              Sign in
            </Link>{" "}
            to save order history.
          </p>
        )}
      </div>
    </StoreShell>
  );
}
