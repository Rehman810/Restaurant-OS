"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Download, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { StoreShell } from "@/components/StoreShell";
import { OrderTrackForm } from "@/components/OrderTrackForm";
import { StatusTrack } from "@/components/StatusTrack";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { api, downloadInvoice } from "@/lib/api";
import { fillCartFromOrder } from "@/lib/reorder-from-order";
import { getGuestOrderToken, orderApiPath, orderCancelPath, saveGuestOrderToken } from "@/lib/guest-order";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { eta, formatWhen, pkr } from "@/lib/format";
import { usePoll } from "@/hooks/usePoll";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { FulfillmentBadge, fulfillmentLabel } from "@/components/FulfillmentBadge";
import { Order, orderStatusLabel } from "@/lib/types";
import { OrderFeedbackForm } from "@/components/OrderFeedbackForm";
import { OrderPushPrompt } from "@/components/OrderPushPrompt";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addConfigured = useCart((s) => s.addConfigured);
  const addDeal = useCart((s) => s.addDeal);
  const { user, loading: authLoading } = useAuth();
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [tokenResolved, setTokenResolved] = useState(false);

  useEffect(() => {
    const fromUrl = searchParams.get("token");
    const fromSession = getGuestOrderToken(id);
    const token = fromUrl || fromSession;
    if (fromUrl) saveGuestOrderToken(id, fromUrl);
    setGuestToken(token);
    setTokenResolved(true);
  }, [id, searchParams]);

  const canLoad = tokenResolved && !authLoading && (Boolean(user) || Boolean(guestToken));
  const needsTrack = tokenResolved && !authLoading && !user && !guestToken;

  const fetchOrder = useCallback(
    () => api<Order>(orderApiPath(id, guestToken)),
    [id, guestToken]
  );

  const { data: order, loading, error: pollError, refresh } = usePoll(fetchOrder, 15000, canLoad);
  useLiveOrders(refresh, id, guestToken);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const accessDenied = needsTrack || pollError?.toLowerCase().includes("access");
  const canCancel =
    order &&
    (order.status === "PENDING_CONFIRMATION" || order.status === "CONFIRMED");

  const terminal =
    order &&
    (order.status === "DELIVERED" || order.status === "COLLECTED" || order.status === "SERVED");
  const showFeedback = terminal && !order.feedback;

  async function cancelOrder(reason?: string) {
    if (!order || !canCancel || !reason?.trim()) return;
    setCancelling(true);
    setCancelError("");
    try {
      await api(orderCancelPath(order.id, guestToken), {
        method: "PATCH",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setCancelOpen(false);
      refresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Could not cancel order.");
    } finally {
      setCancelling(false);
    }
  }

  async function repeatOrder() {
    if (!order) return;
    await fillCartFromOrder(order, { addConfigured, addDeal });
    router.push("/checkout");
  }

  return (
    <StoreShell>
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 pb-32 sm:px-6 md:pb-20">
        {accessDenied && !order && (
          <div className="space-y-6">
            {needsTrack && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Enter your order number and phone to view this order.
              </p>
            )}
            <OrderTrackForm compact />
          </div>
        )}

        {pollError && !accessDenied && !needsTrack && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{pollError}</p>
        )}

        {loading && canLoad && !order && <div className="skeleton h-80 rounded-3xl" />}

        {order && (
          <div className="card space-y-6 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {order.status === "PENDING_CONFIRMATION" ? "Order received" : "Order confirmed"}
                </p>
                <h1 className="font-display text-4xl">{order.orderNumber}</h1>
                <div className="pt-1">
                  <FulfillmentBadge type={order.fulfillmentType} size="md" />
                </div>
                <p className="text-sm text-stone-500">{formatWhen(order.createdAt)}</p>
              </div>
              <CheckCircle2
                className={`shrink-0 ${
                  order.status === "PENDING_CONFIRMATION" ? "text-orange-500" : "text-emerald-500"
                }`}
                size={32}
              />
            </div>

            {order.status === "PENDING_CONFIRMATION" ? (
              <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 text-sm leading-relaxed text-orange-950">
                We&apos;ll call you on <strong>{order.customerPhone}</strong> shortly to verify this order before the kitchen starts.
              </p>
            ) : (
              <p className="rounded-2xl bg-brand-50 px-4 py-3.5 text-sm">
                Status: <strong>{orderStatusLabel(order.status, order.fulfillmentType)}</strong> · Est. {eta(order.createdAt)}
              </p>
            )}

            <div className="pt-2">
              <StatusTrack status={order.status} fulfillmentType={order.fulfillmentType} />
            </div>

            {order.status !== "CANCELLED" && !terminal && (
              <OrderPushPrompt orderId={order.id} />
            )}

            {showFeedback && (
              <OrderFeedbackForm
                orderId={order.id}
                guestToken={guestToken}
                onSubmitted={refresh}
              />
            )}

            <div className="space-y-3 border-t border-orange-100 pt-6">
              <p className="text-sm font-semibold text-stone-800">Your bag</p>
              <ul className="space-y-3 text-sm">
                {order.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {i.quantity}× {i.nameAtOrder}
                    </span>
                    <span className="shrink-0 font-medium">{pkr(Number(i.priceAtOrder) * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 border-t border-orange-100 pt-5 text-sm">
              {order.subtotal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Subtotal</span>
                  <span>{pkr(order.subtotal)}</span>
                </div>
              )}
              {order.fulfillmentType === "DELIVERY" && Number(order.deliveryCharge || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone-500">
                    Delivery{order.deliveryArea?.name ? ` · ${order.deliveryArea.name}` : ""}
                  </span>
                  <span>{pkr(order.deliveryCharge!)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span className="text-brand-700">{pkr(order.total)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#fffaf5] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {fulfillmentLabel(order.fulfillmentType)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{order.deliveryAddress}</p>
              {order.notes && (
                <p className="mt-2 text-sm italic text-stone-500">&ldquo;{order.notes}&rdquo;</p>
              )}
            </div>

            {cancelError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{cancelError}</p>
            )}

            <div className="space-y-3 border-t border-orange-100 pt-6">
              {canCancel && (
                <button
                  type="button"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
                  onClick={() => setCancelOpen(true)}
                  disabled={cancelling}
                >
                  <XCircle size={16} /> {cancelling ? "Cancelling…" : "Cancel order"}
                </button>
              )}
              <button type="button" className="btn-ghost h-12 w-full" onClick={repeatOrder}>
                <RotateCcw size={16} /> Order again
              </button>
              {(terminal || order.invoice) && (
                <button
                  type="button"
                  className="btn-primary h-12 w-full"
                  onClick={() => downloadInvoice(order.id, guestToken)}
                >
                  <Download size={16} /> Download invoice
                </button>
              )}
            </div>

            <p className="text-center text-xs text-stone-400">
              Save order <strong>{order.orderNumber}</strong> to track again later ·{" "}
              <Link href="/orders" className="font-semibold text-brand-700 hover:underline">
                Track another order
              </Link>
            </p>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={cancelOpen}
        title="Cancel this order?"
        message="This cannot be undone. The kitchen will be notified."
        confirmLabel="Cancel order"
        danger
        reasonLabel="Reason"
        reasonPlaceholder="Why are you cancelling?"
        reasonRequired
        saving={cancelling}
        error={cancelError}
        onClose={() => {
          if (!cancelling) setCancelOpen(false);
        }}
        onConfirm={cancelOrder}
      />
    </StoreShell>
  );
}
