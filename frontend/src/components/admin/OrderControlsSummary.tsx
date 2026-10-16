import { pkr } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderControlsSummary({ order }: { order: Order }) {
  const hasDiscount = Number(order.discountAmount ?? 0) > 0 || order.discountPercent;
  const hasVoid = Boolean(order.voidReasonCode);
  const hasRefund = order.refundAmount != null && Number(order.refundAmount) > 0;
  if (!hasDiscount && !hasVoid && !hasRefund) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-stone-800 dark:text-stone-100">Adjustments</h3>
      <dl className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/50 p-4 text-sm dark:border-stone-600 dark:bg-stone-800/40">
        {hasDiscount && (
          <div>
            <dt className="text-xs font-semibold uppercase text-stone-500">Discount</dt>
            <dd className="mt-1 text-stone-800 dark:text-stone-100">
              {order.discountPercent ? `${order.discountPercent}%` : ""}
              {Number(order.discountAmount ?? 0) > 0 ? ` · ${pkr(order.discountAmount!)}` : ""}
              {order.adjustmentReasonCode && (
                <span className="block text-stone-600 dark:text-stone-300">Reason: {order.adjustmentReasonCode}</span>
              )}
              {order.adjustmentReasonNote && (
                <span className="block text-stone-500">{order.adjustmentReasonNote}</span>
              )}
              {order.adjustmentApprovedBy && (
                <span className="block text-xs text-stone-500">Approved by {order.adjustmentApprovedBy.name}</span>
              )}
            </dd>
          </div>
        )}
        {hasVoid && (
          <div>
            <dt className="text-xs font-semibold uppercase text-stone-500">Void</dt>
            <dd className="mt-1 text-stone-800 dark:text-stone-100">
              {order.voidReasonCode}
              {order.voidReasonNote && <span className="block text-stone-500">{order.voidReasonNote}</span>}
              {order.voidApprovedBy && (
                <span className="block text-xs text-stone-500">Approved by {order.voidApprovedBy.name}</span>
              )}
            </dd>
          </div>
        )}
        {hasRefund && (
          <div>
            <dt className="text-xs font-semibold uppercase text-stone-500">Refund</dt>
            <dd className="mt-1 text-stone-800 dark:text-stone-100">
              {pkr(order.refundAmount!)}
              {order.refundReasonCode && (
                <span className="block text-stone-600 dark:text-stone-300">Reason: {order.refundReasonCode}</span>
              )}
              {order.refundApprovedBy && (
                <span className="block text-xs text-stone-500">Approved by {order.refundApprovedBy.name}</span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
