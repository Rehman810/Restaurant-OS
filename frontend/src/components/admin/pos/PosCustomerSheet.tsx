"use client";

import type { DeliveryArea, FulfillmentType } from "@/lib/types";
import { PosDeliveryFields } from "@/components/admin/pos/PosDeliveryFields";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: FulfillmentType;
  areas: DeliveryArea[];
  areaId: string;
  onAreaId: (id: string) => void;
  deliveryAddress: string;
  onDeliveryAddress: (v: string) => void;
  customerName: string;
  onCustomerName: (v: string) => void;
  customerPhone: string;
  onCustomerPhone: (v: string) => void;
};

export function PosCustomerSheet({
  open,
  onClose,
  mode,
  areas,
  areaId,
  onAreaId,
  deliveryAddress,
  onDeliveryAddress,
  customerName,
  onCustomerName,
  customerPhone,
  onCustomerPhone,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-customer-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h3 id="pos-customer-title" className="text-lg font-bold text-stone-900 dark:text-stone-50">
            {mode === "DELIVERY" ? "Customer & delivery" : "Customer"}
          </h3>
          <button type="button" className="text-sm font-semibold text-stone-500" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <PosDeliveryFields
            variant="plain"
            mode={mode}
            deliveryAreas={areas}
            deliveryAreaId={areaId}
            onDeliveryAreaId={onAreaId}
            deliveryAddress={deliveryAddress}
            onDeliveryAddress={onDeliveryAddress}
            customerName={customerName}
            onCustomerName={onCustomerName}
            customerPhone={customerPhone}
            onCustomerPhone={onCustomerPhone}
            showValidation
          />
        </div>

        <div className="shrink-0 border-t border-stone-200 p-4 dark:border-stone-700">
          <button type="button" className="btn-primary min-h-12 w-full text-sm font-bold" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
