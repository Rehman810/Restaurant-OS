import type { DeliveryArea, DeliveryPause, User } from "@prisma/client";
import { computeDeliveryFee } from "./fee";
import type { StoreSettings } from "@prisma/client";

export function serializePublicArea(
  area: DeliveryArea,
  settings: Pick<
    StoreSettings,
    "minimumOrder" | "freeDeliveryAbove" | "deliveryEstimateMin" | "deliveryEstimateMax"
  >,
  paused: boolean
) {
  const fee = computeDeliveryFee(
    {
      deliveryCharge: Number(area.deliveryCharge),
      minOrder: area.minOrder != null ? Number(area.minOrder) : null,
      freeAbove: area.freeAbove != null ? Number(area.freeAbove) : null,
      etaMinMinutes: area.etaMinMinutes,
      etaMaxMinutes: area.etaMaxMinutes,
    },
    0,
    settings
  );
  return {
    id: area.id,
    name: area.name,
    slug: area.slug,
    covers: area.covers ?? [],
    charge: Number(area.deliveryCharge),
    minOrder: fee.effectiveMinOrder,
    freeAbove: fee.freeAbove,
    etaMinMinutes: fee.etaMinMinutes,
    etaMaxMinutes: fee.etaMaxMinutes,
    position: area.sortOrder,
    paused,
  };
}

export function serializeAdminAreaRow(
  area: DeliveryArea & {
    ordersCount30d?: number;
    avgDeliveryMinutes?: number | null;
    branchIds?: string[];
    paused?: boolean;
  }
) {
  return {
    id: area.id,
    name: area.name,
    slug: area.slug,
    covers: area.covers ?? [],
    charge: Number(area.deliveryCharge),
    minOrder: area.minOrder != null ? Number(area.minOrder) : null,
    freeAbove: area.freeAbove != null ? Number(area.freeAbove) : null,
    etaMinMinutes: area.etaMinMinutes,
    etaMaxMinutes: area.etaMaxMinutes,
    isDelivering: area.isDelivering,
    isActive: area.isActive,
    archivedAt: area.archivedAt?.toISOString() ?? null,
    position: area.sortOrder,
    ordersCount30d: area.ordersCount30d ?? 0,
    avgDeliveryMinutes: area.avgDeliveryMinutes ?? null,
    branchIds: area.branchIds ?? [],
    paused: area.paused ?? false,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  };
}

export function serializePause(
  p: DeliveryPause & { pausedBy: Pick<User, "id" | "name"> }
) {
  return {
    id: p.id,
    scope: p.scope as "all" | "areas",
    areaIds: p.areaIds,
    pausedAt: p.pausedAt.toISOString(),
    until: p.until?.toISOString() ?? null,
    reason: p.reason,
    pausedBy: p.pausedBy,
  };
}
