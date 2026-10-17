"use client";

import { FulfillmentType, OrderStatus, orderStatusLabel, statusFlowFor } from "@/lib/types";
import { useStorefrontLocale } from "@/lib/i18n/storefront";

function gridClassForSteps(count: number) {
  if (count <= 4) return "grid-cols-2 sm:grid-cols-4";
  if (count === 5) return "grid-cols-2 sm:grid-cols-5";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
}

export function StatusTrack({
  status,
  fulfillmentType,
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType | null;
}) {
  const { t } = useStorefrontLocale();
  const flow = statusFlowFor(fulfillmentType);

  if (status === "CANCELLED") {
    return (
      <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-medium text-stone-600">
        {t("order_cancelled")}
      </div>
    );
  }

  const idx = flow.indexOf(status);
  const activeIdx = idx >= 0 ? idx : flow.length - 1;

  return (
    <ol className={`grid gap-2 ${gridClassForSteps(flow.length)}`}>
      {flow.map((s, i) => {
        const done = i <= activeIdx;
        return (
          <li key={s} className="text-center">
            <div className={`mx-auto h-1.5 rounded-full ${done ? "bg-brand-600" : "bg-stone-200"}`} />
            <p
              className={`mt-2 text-[10px] font-semibold leading-tight sm:text-[11px] ${
                done ? "text-brand-800" : "text-stone-400"
              }`}
            >
              {orderStatusLabel(s, fulfillmentType)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
