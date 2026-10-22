import { api } from "@/lib/api";
import type { DeliveryArea } from "@/lib/types";

export type DeliveryAreasPublicResponse = {
  paused: boolean;
  pausedMessage: string | null;
  areas: DeliveryArea[];
  settings?: {
    minimumOrder: number;
    freeDeliveryAbove: number | null;
    deliveryEstimateMin: number;
    deliveryEstimateMax: number;
  };
};

/** Normalize public delivery-areas API (legacy array or envelope). */
export async function fetchPublicDeliveryAreas(branchId?: string) {
  const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  const raw = await api<DeliveryArea[] | DeliveryAreasPublicResponse>(`/delivery-areas${q}`).catch(
    () => [] as DeliveryArea[]
  );
  if (Array.isArray(raw)) {
    return { paused: false, pausedMessage: null, areas: raw };
  }
  return {
    paused: raw.paused,
    pausedMessage: raw.pausedMessage,
    areas: raw.areas.map((a) => ({
      ...a,
      deliveryCharge: a.charge ?? a.deliveryCharge,
      isDelivering: true,
      sortOrder: a.position ?? a.sortOrder ?? 0,
    })),
    settings: raw.settings,
  };
}
