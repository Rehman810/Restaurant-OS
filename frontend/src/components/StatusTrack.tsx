"use client";

import { FulfillmentType, OrderStatus, STATUS_FLOW, orderStatusLabel } from "@/lib/types";
import { useStorefrontLocale } from "@/lib/i18n/storefront";

export function StatusTrack({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType | null;
}) {
  const { t } = useStorefrontLocale();
  if (status === "CANCELLED") {
    return (
      <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-600">
        {t("order_cancelled")}
      </div>
    );
  }
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STATUS_FLOW.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="text-center">
            <div className={`mx-auto h-1.5 rounded-full ${done ? "bg-brand-600" : "bg-stone-200"}`} />
            <p className={`mt-2 text-[10px] font-semibold leading-tight sm:text-[11px] ${done ? "text-brand-800" : "text-stone-400"}`}>
              {orderStatusLabel(s, fulfillmentType)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
