import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AuditAction } from "../audit-actions";
import { writeAudit } from "../audit";
import { bumpDeliveryAreasPublicCache } from "./public-cache";
import { emitDeliveryAreasChanged } from "../realtime";
import {
  normalizeCovers,
  parseMoneyInt,
  slugifyAreaName,
  validateAreaFields,
} from "./validate";
import type { StoreSettings } from "@prisma/client";
import { clientIp } from "../client-ip";
import type { Request } from "express";
import type { AuthUser } from "../../middleware/auth";
import { getRestaurantId } from "../restaurant-context";

export function areaAuditSnapshot(area: {
  name: string;
  deliveryCharge: Prisma.Decimal | number;
  minOrder: Prisma.Decimal | null;
  freeAbove: Prisma.Decimal | null;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  isDelivering: boolean;
  covers: string[];
  sortOrder: number;
  archivedAt: Date | null;
}) {
  return {
    name: area.name,
    charge: Number(area.deliveryCharge),
    minOrder: area.minOrder != null ? Number(area.minOrder) : null,
    freeAbove: area.freeAbove != null ? Number(area.freeAbove) : null,
    etaMinMinutes: area.etaMinMinutes,
    etaMaxMinutes: area.etaMaxMinutes,
    isDelivering: area.isDelivering,
    covers: area.covers,
    position: area.sortOrder,
    archivedAt: area.archivedAt?.toISOString() ?? null,
  };
}

async function nameTaken(name: string, excludeId?: string) {
  const existing = await prisma.deliveryArea.findFirst({
    where: {
      restaurantId: getRestaurantId(),
      archivedAt: null,
      name: { equals: name.trim(), mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function invalidateDeliveryAreas() {
  bumpDeliveryAreasPublicCache();
  emitDeliveryAreasChanged();
}

export async function createDeliveryArea(
  body: Record<string, unknown>,
  settings: StoreSettings,
  actor: AuthUser,
  req: Request
) {
  const name = String(body.name ?? "").trim();
  const charge = parseMoneyInt(body.charge ?? body.deliveryCharge) ?? 0;
  const fieldErrors = validateAreaFields({ name, charge }, settings);
  if (fieldErrors.name) return { status: 400, error: fieldErrors.name };
  if (fieldErrors.charge) return { status: 400, error: fieldErrors.charge };
  if (await nameTaken(name)) return { status: 409, error: "An area with this name already exists." };

  const maxOrder = await prisma.deliveryArea.aggregate({ _max: { sortOrder: true } });
  const area = await prisma.deliveryArea.create({
    data: {
      name,
      slug: slugifyAreaName(name),
      deliveryCharge: charge,
      covers: normalizeCovers(body.covers),
      minOrder: parseMoneyInt(body.minOrder),
      freeAbove: parseMoneyInt(body.freeAbove),
      etaMinMinutes: body.etaMinMinutes != null ? Number(body.etaMinMinutes) : null,
      etaMaxMinutes: body.etaMaxMinutes != null ? Number(body.etaMaxMinutes) : null,
      isDelivering: body.isDelivering !== false,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.DELIVERY_AREA_CREATED,
    entityType: "delivery_area",
    entityId: area.id,
    entityLabel: area.name,
    after: areaAuditSnapshot(area),
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return { status: 201, area };
}

export async function updateDeliveryArea(
  id: string,
  body: Record<string, unknown>,
  settings: StoreSettings,
  actor: AuthUser,
  req: Request
) {
  const area = await prisma.deliveryArea.findUnique({ where: { id } });
  if (!area) return { status: 404, error: "Area not found." };
  const before = areaAuditSnapshot(area);

  const data: Prisma.DeliveryAreaUpdateInput = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    const errs = validateAreaFields({ name }, settings);
    if (errs.name) return { status: 400, error: errs.name };
    if (await nameTaken(name, id)) return { status: 409, error: "An area with this name already exists." };
    data.name = name;
    data.slug = slugifyAreaName(name);
  }
  let charge: number | undefined;
  if (body.charge !== undefined || body.deliveryCharge !== undefined) {
    const parsed = parseMoneyInt(body.charge ?? body.deliveryCharge);
    if (parsed === null) return { status: 400, error: "Delivery charge must be zero or greater." };
    charge = parsed;
    const errs = validateAreaFields({ charge }, settings);
    if (errs.charge) return { status: 400, error: errs.charge };
    data.deliveryCharge = charge;
  }
  if (body.covers !== undefined) data.covers = normalizeCovers(body.covers);
  if (body.minOrder !== undefined) {
    if (body.minOrder === null || body.minOrder === "") data.minOrder = null;
    else {
      const v = parseMoneyInt(body.minOrder);
      if (v === null) return { status: 400, error: "Minimum order must be zero or greater." };
      data.minOrder = v;
    }
  }
  if (body.freeAbove !== undefined) {
    if (body.freeAbove === null || body.freeAbove === "") data.freeAbove = null;
    else {
      const v = parseMoneyInt(body.freeAbove);
      if (v === null) return { status: 400, error: "Free-delivery threshold must be zero or greater." };
      data.freeAbove = v;
    }
  }
  if (body.etaMinMinutes !== undefined) {
    data.etaMinMinutes = body.etaMinMinutes === null ? null : Number(body.etaMinMinutes);
  }
  if (body.etaMaxMinutes !== undefined) {
    data.etaMaxMinutes = body.etaMaxMinutes === null ? null : Number(body.etaMaxMinutes);
  }
  if (body.isDelivering !== undefined) data.isDelivering = Boolean(body.isDelivering);
  if (body.position !== undefined || body.sortOrder !== undefined) {
    data.sortOrder = Number(body.position ?? body.sortOrder);
  }
  if (body.branchIds !== undefined && Array.isArray(body.branchIds)) {
    const branchIds = body.branchIds.map((x) => String(x));
    await prisma.deliveryAreaBranch.deleteMany({ where: { areaId: id } });
    if (branchIds.length) {
      await prisma.deliveryAreaBranch.createMany({
        data: branchIds.map((branchId) => ({ areaId: id, branchId })),
        skipDuplicates: true,
      });
    }
  }

  const merged = {
    name: (data.name as string) ?? area.name,
    charge: charge ?? Number(area.deliveryCharge),
    minOrder:
      body.minOrder !== undefined
        ? parseMoneyInt(body.minOrder)
        : area.minOrder != null
          ? Number(area.minOrder)
          : null,
    freeAbove:
      body.freeAbove !== undefined
        ? parseMoneyInt(body.freeAbove)
        : area.freeAbove != null
          ? Number(area.freeAbove)
          : null,
    etaMinMinutes:
      body.etaMinMinutes !== undefined ? (body.etaMinMinutes === null ? null : Number(body.etaMinMinutes)) : area.etaMinMinutes,
    etaMaxMinutes:
      body.etaMaxMinutes !== undefined ? (body.etaMaxMinutes === null ? null : Number(body.etaMaxMinutes)) : area.etaMaxMinutes,
  };
  const fieldErrors = validateAreaFields(merged, settings);
  if (fieldErrors.minOrder) return { status: 400, error: fieldErrors.minOrder };
  if (fieldErrors.freeAbove) return { status: 400, error: fieldErrors.freeAbove };
  if (fieldErrors.eta) return { status: 400, error: fieldErrors.eta };

  const updated = await prisma.deliveryArea.update({ where: { id }, data });
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: body.name !== undefined ? AuditAction.DELIVERY_AREA_RENAMED : AuditAction.DELIVERY_AREA_UPDATED,
    entityType: "delivery_area",
    entityId: id,
    entityLabel: updated.name,
    before,
    after: areaAuditSnapshot(updated),
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return { status: 200, area: updated, chargeWarning: fieldErrors.chargeWarning };
}

export async function archiveDeliveryArea(id: string, actor: AuthUser, req: Request, restore = false) {
  const area = await prisma.deliveryArea.findUnique({ where: { id } });
  if (!area) return { status: 404, error: "Area not found." };
  const before = areaAuditSnapshot(area);
  const updated = await prisma.deliveryArea.update({
    where: { id },
    data: restore
      ? { archivedAt: null, isActive: true }
      : { archivedAt: new Date(), isActive: false, isDelivering: false },
  });
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: restore ? AuditAction.DELIVERY_AREA_RESTORED : AuditAction.DELIVERY_AREA_ARCHIVED,
    entityType: "delivery_area",
    entityId: id,
    entityLabel: area.name,
    before,
    after: areaAuditSnapshot(updated),
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return { status: 200, area: updated };
}

export async function deleteDeliveryAreaIfAllowed(id: string, actor: AuthUser, req: Request) {
  const area = await prisma.deliveryArea.findUnique({ where: { id } });
  if (!area) return { status: 404, error: "Area not found." };
  const [orders, usersWithAddress] = await Promise.all([
    prisma.order.count({ where: { deliveryAreaId: id } }),
    prisma.order.count({
      where: { deliveryAddress: { contains: area.name, mode: "insensitive" } },
    }),
  ]);
  const usage = { orders, addressMentions: usersWithAddress };
  if (orders > 0) {
    return {
      status: 409,
      error: "Area is referenced by orders. Archive it instead.",
      usage,
    };
  }
  await prisma.deliveryAreaBranch.deleteMany({ where: { areaId: id } });
  await prisma.deliveryArea.delete({ where: { id } });
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.DELIVERY_AREA_DELETED,
    entityType: "delivery_area",
    entityId: id,
    entityLabel: area.name,
    before: areaAuditSnapshot(area),
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return { status: 200, usage };
}

export async function reorderDeliveryAreas(
  orderedIds: string[],
  actor: AuthUser,
  req: Request
) {
  const areas = await prisma.deliveryArea.findMany({
    where: { id: { in: orderedIds }, archivedAt: null },
    select: { id: true, sortOrder: true },
  });
  const before = areas.map((a) => ({ id: a.id, position: a.sortOrder }));
  let pos = 1;
  for (const id of orderedIds) {
    await prisma.deliveryArea.update({ where: { id }, data: { sortOrder: pos } });
    pos += 1;
  }
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.DELIVERY_AREA_REORDERED,
    entityType: "delivery_area",
    entityId: "reorder",
    before: { order: before },
    after: { order: orderedIds.map((id, i) => ({ id, position: i + 1 })) },
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return { status: 200 };
}

export type BulkItemResult = { id: string; ok: boolean; error?: string };

export async function bulkDeliveryAreas(
  action: string,
  ids: string[],
  body: Record<string, unknown>,
  actor: AuthUser,
  req: Request
) {
  const limited = ids.slice(0, 100);
  const results: BulkItemResult[] = [];
  for (const id of limited) {
    try {
      if (action === "pause") {
        await prisma.deliveryArea.update({ where: { id }, data: { isDelivering: false } });
        results.push({ id, ok: true });
      } else if (action === "resume") {
        await prisma.deliveryArea.update({ where: { id }, data: { isDelivering: true } });
        results.push({ id, ok: true });
      } else if (action === "archive") {
        const r = await archiveDeliveryArea(id, actor, req, false);
        results.push({ id, ok: r.status === 200, error: r.error });
      } else if (action === "setCharge") {
        const charge = parseMoneyInt(body.charge);
        if (charge == null) {
          results.push({ id, ok: false, error: "Invalid charge." });
          continue;
        }
        await prisma.deliveryArea.update({ where: { id }, data: { deliveryCharge: charge } });
        results.push({ id, ok: true });
      } else {
        results.push({ id, ok: false, error: "Unknown action." });
      }
    } catch {
      results.push({ id, ok: false, error: "Update failed." });
    }
  }
  await writeAudit(prisma, {
    actorId: actor.id,
    actorRole: actor.role,
    action: AuditAction.DELIVERY_AREA_BULK,
    entityType: "delivery_area",
    entityId: "bulk",
    after: { action, results },
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  return results;
}
