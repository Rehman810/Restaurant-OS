import type { DeliveryPause, User } from "@prisma/client";
import { prisma } from "../prisma";
import { branchDayRangeUtc } from "../dine-in/branch-time";

export type ActivePauseInfo = {
  id: string;
  scope: "all" | "areas";
  areaIds: string[];
  pausedAt: Date;
  until: Date | null;
  reason: string;
  pausedBy: { id: string; name: string };
};

export type PauseDurationInput =
  | { kind: "until_resume" }
  | { kind: "hours"; hours: number }
  | { kind: "until"; at: Date }
  | { kind: "end_of_store_day" };

export function resolvePauseUntil(
  input: PauseDurationInput,
  timezone: string,
  now = new Date()
): Date | null {
  if (input.kind === "until_resume") return null;
  if (input.kind === "hours") {
    return new Date(now.getTime() + input.hours * 60 * 60 * 1000);
  }
  if (input.kind === "until") return input.at;
  if (input.kind === "end_of_store_day") {
    return branchDayRangeUtc(timezone, now).endUtc;
  }
  return null;
}

export function isPauseExpired(pause: Pick<DeliveryPause, "until" | "resumedAt">, now = new Date()) {
  if (pause.resumedAt) return true;
  if (pause.until == null) return false;
  return pause.until.getTime() <= now.getTime();
}

export async function autoResumeExpiredPauses(restaurantId: string, now = new Date()) {
  await prisma.deliveryPause.updateMany({
    where: {
      restaurantId,
      resumedAt: null,
      until: { lte: now },
    },
    data: { resumedAt: now },
  });
}

export async function loadActivePauses(
  restaurantId: string,
  now = new Date()
): Promise<(DeliveryPause & { pausedBy: Pick<User, "id" | "name"> })[]> {
  await autoResumeExpiredPauses(restaurantId, now);
  const rows = await prisma.deliveryPause.findMany({
    where: { restaurantId, resumedAt: null },
    include: { pausedBy: { select: { id: true, name: true } } },
    orderBy: { pausedAt: "desc" },
  });
  return rows.filter((p) => !isPauseExpired(p, now));
}

export function areaIsPausedByRecords(
  areaId: string,
  pauses: Pick<DeliveryPause, "scope" | "areaIds">[]
) {
  for (const p of pauses) {
    if (p.scope === "all") return true;
    if (p.scope === "areas" && p.areaIds.includes(areaId)) return true;
  }
  return false;
}

export function serializeActivePause(p: ActivePauseInfo) {
  return {
    id: p.id,
    scope: p.scope,
    areaIds: p.areaIds,
    pausedAt: p.pausedAt.toISOString(),
    until: p.until?.toISOString() ?? null,
    reason: p.reason,
    pausedBy: p.pausedBy,
  };
}
