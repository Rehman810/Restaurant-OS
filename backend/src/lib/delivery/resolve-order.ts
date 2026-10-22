import type { DeliveryArea, StoreSettings } from "@prisma/client";
import { formatMoney } from "../money";
import { computeDeliveryFee } from "./fee";
import { addressMatchesArea } from "./match-address";
import type { DeliveryPause } from "@prisma/client";
import { areaIsPausedByRecords } from "./pause";

export type ResolvedDeliveryForOrder = {
  areaId: string;
  areaName: string;
  deliveryCharge: number;
  fee: ReturnType<typeof computeDeliveryFee>;
  addressWarning: boolean;
  covers: string[];
};

export function assertDeliveryAreaForOrder(input: {
  area: DeliveryArea | null;
  subtotal: number;
  settings: StoreSettings;
  pauses: Pick<DeliveryPause, "scope" | "areaIds">[];
  address: string;
  expectedDeliveryCharge?: number | null;
}): { ok: true; resolved: ResolvedDeliveryForOrder } | { ok: false; status: number; error: string } {
  const { area, subtotal, settings, pauses, address, expectedDeliveryCharge } = input;
  if (!area || area.archivedAt || !area.isActive) {
    return { ok: false, status: 400, error: "Selected area is not available for delivery." };
  }
  if (!area.isDelivering) {
    return { ok: false, status: 400, error: "Delivery to this area is paused right now." };
  }
  if (areaIsPausedByRecords(area.id, pauses)) {
    return {
      ok: false,
      status: 400,
      error: "Delivery is temporarily paused. Please try again later or choose pickup.",
    };
  }
  const fee = computeDeliveryFee(
    {
      deliveryCharge: Number(area.deliveryCharge),
      minOrder: area.minOrder != null ? Number(area.minOrder) : null,
      freeAbove: area.freeAbove != null ? Number(area.freeAbove) : null,
      etaMinMinutes: area.etaMinMinutes,
      etaMaxMinutes: area.etaMaxMinutes,
    },
    subtotal,
    settings
  );
  if (!fee.minOrderMet) {
    return {
      ok: false,
      status: 400,
      error: `Minimum order for this area is ${formatMoney(fee.effectiveMinOrder, settings)}. Add more items to continue.`,
    };
  }
  if (
    expectedDeliveryCharge != null &&
    Number.isFinite(expectedDeliveryCharge) &&
    Math.round(expectedDeliveryCharge) !== fee.charge
  ) {
    return {
      ok: false,
      status: 400,
      error: "Delivery fee changed. Refresh checkout and try again.",
    };
  }
  const match = addressMatchesArea(address, { name: area.name, covers: area.covers ?? [] });
  const addressWarning = address.trim().length > 0 && !match.matches;
  return {
    ok: true,
    resolved: {
      areaId: area.id,
      areaName: area.name,
      deliveryCharge: fee.charge,
      fee,
      addressWarning,
      covers: area.covers ?? [],
    },
  };
}
