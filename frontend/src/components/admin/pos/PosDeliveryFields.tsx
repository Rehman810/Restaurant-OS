"use client";

import type { DeliveryArea, FulfillmentType } from "@/lib/types";
import { pkr } from "@/lib/format";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { getDeliveryFieldErrors } from "@/lib/pos/delivery-customer";

type Props = {
  mode: FulfillmentType;
  deliveryAreas: DeliveryArea[];
  deliveryAreaId: string;
  onDeliveryAreaId: (id: string) => void;
  deliveryAddress: string;
  onDeliveryAddress: (v: string) => void;
  customerName: string;
  onCustomerName: (v: string) => void;
  customerPhone: string;
  onCustomerPhone: (v: string) => void;
  /** Card chrome for cart sidebar; plain for modal */
  variant?: "card" | "plain";
  /** Show inline validation (delivery mode). */
  showValidation?: boolean;
};

export function PosDeliveryFields({
  mode,
  deliveryAreas,
  deliveryAreaId,
  onDeliveryAreaId,
  deliveryAddress,
  onDeliveryAddress,
  customerName,
  onCustomerName,
  customerPhone,
  onCustomerPhone,
  variant = "card",
  showValidation = false,
}: Props) {
  const areaOptions = deliveryAreas.map((a) => ({
    value: a.id,
    label: `${a.name} (+${pkr(a.deliveryCharge)})`,
  }));

  const wrap =
    variant === "card"
      ? "space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-600 dark:bg-stone-800/50"
      : "space-y-3";

  const showDelivery = mode === "DELIVERY";
  const fieldErrors =
    showDelivery && showValidation
      ? getDeliveryFieldErrors({
          deliveryAreaId,
          deliveryAddress,
          customerName,
          customerPhone,
        })
      : {};

  const inputClass = (key: keyof typeof fieldErrors) =>
    `input mt-1 w-full text-sm ${fieldErrors[key] ? "ring-2 ring-rose-400 dark:ring-rose-500" : ""}`;

  return (
    <div className={wrap}>
      {variant === "card" && showDelivery && (
        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Delivery details</p>
      )}

      <div className={showDelivery ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2" : "space-y-2.5"}>
        <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300">
          Customer name{showDelivery ? " *" : ""}
          <input
            className={`${inputClass("name")} h-11`}
            placeholder={showDelivery ? "Full name" : "Name (optional)"}
            value={customerName}
            onChange={(e) => onCustomerName(e.target.value)}
            autoComplete="name"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-[11px] font-medium text-rose-600" role="alert">{fieldErrors.name}</p>
          )}
        </label>
        <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300">
          Phone{showDelivery ? " *" : ""}
          <input
            className={`${inputClass("phone")} h-11`}
            placeholder="03xx…"
            value={customerPhone}
            onChange={(e) => onCustomerPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-[11px] font-medium text-rose-600" role="alert">{fieldErrors.phone}</p>
          )}
        </label>
      </div>

      {showDelivery && (
        <>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300">
            Delivery area *
            {areaOptions.length > 0 ? (
              <div className="mt-1">
                <AdminSelect
                  value={deliveryAreaId}
                  onChange={onDeliveryAreaId}
                  options={areaOptions}
                  placeholder="Choose area"
                  aria-label="Delivery area"
                  className="w-full"
                  minWidth="min-w-0"
                />
              </div>
            ) : (
              <p className="mt-1 text-xs text-rose-600">No delivery areas configured.</p>
            )}
            {fieldErrors.area && (
              <p className="mt-1 text-[11px] font-medium text-rose-600" role="alert">{fieldErrors.area}</p>
            )}
          </label>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300">
            Delivery address *
            <textarea
              className={`${inputClass("address")} min-h-[5.5rem] resize-y leading-snug`}
              placeholder="Street, building, floor, landmark"
              rows={3}
              value={deliveryAddress}
              onChange={(e) => onDeliveryAddress(e.target.value)}
              aria-invalid={Boolean(fieldErrors.address)}
            />
            {fieldErrors.address && (
              <p className="mt-1 text-[11px] font-medium text-rose-600" role="alert">{fieldErrors.address}</p>
            )}
          </label>
        </>
      )}
    </div>
  );
}
