import { Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../prisma";
import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { clientIp } from "../client-ip";
import { DISH_DESC_MAX, DISH_NAME_MAX, MENU_ALLERGENS } from "./constants";
import { menuItemUsageCounts, usageBlocksDelete } from "./usage";
import { notifyMenuChanged } from "./emit";
import { soldOutPatchToRow, type SoldOutPatchInput } from "./availability";

export async function validateDishNameUnique(name: string, category: string, excludeId?: string) {
  const existing = await prisma.menuItem.findFirst({
    where: {
      category,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

export function validateAllergens(allergens: string[]) {
  const allowed = new Set<string>(MENU_ALLERGENS);
  return allergens.every((a) => allowed.has(a));
}

export async function patchDishAvailability(
  req: Request,
  type: "dish" | "deal",
  id: string,
  branchId: string,
  timezone: string,
  input: SoldOutPatchInput,
  scope: "currentBranch" | "allBranches"
) {
  const user = req.user!;
  const rowData = soldOutPatchToRow(input, timezone);

  const branchIds =
    scope === "allBranches" && (user.role === Role.ADMIN || user.role === Role.MANAGER)
      ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((b) => b.id)
      : [branchId];

  if (type === "dish") {
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) return { status: 404 as const, error: "Dish not found." };

    const before = await prisma.menuItemBranchAvailability.findMany({
      where: { menuItemId: id, branchId: { in: branchIds } },
    });

    await prisma.$transaction(async (tx) => {
      for (const bid of branchIds) {
        if (input.state === "available") {
          await tx.menuItemBranchAvailability.deleteMany({ where: { menuItemId: id, branchId: bid } });
        } else {
          await tx.menuItemBranchAvailability.upsert({
            where: { menuItemId_branchId: { menuItemId: id, branchId: bid } },
            create: {
              menuItemId: id,
              branchId: bid,
              ...rowData,
              setById: user.id,
            },
            update: { ...rowData, setById: user.id, setAt: new Date() },
          });
        }
      }
      await writeAudit(tx, {
        actorId: user.id,
        actorRole: user.role,
        action: AuditAction.ITEM_AVAILABILITY_CHANGED,
        entityType: "menu_item",
        entityId: id,
        before: { branches: before },
        after: { state: input.state, until: input.until ?? null, scope, branchIds },
        ip: clientIp(req),
      });
    });
  } else {
    const deal = await prisma.deal.findUnique({ where: { id } });
    if (!deal) return { status: 404 as const, error: "Deal not found." };
    await prisma.$transaction(async (tx) => {
      for (const bid of branchIds) {
        if (input.state === "available") {
          await tx.dealBranchAvailability.deleteMany({ where: { dealId: id, branchId: bid } });
        } else {
          await tx.dealBranchAvailability.upsert({
            where: { dealId_branchId: { dealId: id, branchId: bid } },
            create: { dealId: id, branchId: bid, ...rowData, setById: user.id },
            update: { ...rowData, setById: user.id, setAt: new Date() },
          });
        }
      }
      await writeAudit(tx, {
        actorId: user.id,
        actorRole: user.role,
        action: AuditAction.ITEM_AVAILABILITY_CHANGED,
        entityType: "deal",
        entityId: id,
        before: {},
        after: { state: input.state, until: input.until ?? null, scope, branchIds },
        ip: clientIp(req),
      });
    });
  }

  notifyMenuChanged(branchIds);
  return { status: 200 as const, ok: true };
}

export async function setDealVisibility(req: Request, id: string, visible: boolean) {
  const prior = await prisma.deal.findUnique({ where: { id } });
  if (!prior) return { status: 404 as const, error: "Deal not found." };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.deal.update({
      where: { id },
      data: { isVisible: visible, isActive: visible },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.ITEM_VISIBILITY_CHANGED,
      entityType: "deal",
      entityId: id,
      before: { isVisible: prior.isVisible, isActive: prior.isActive },
      after: { isVisible: visible, isActive: visible },
      ip: clientIp(req),
    });
    return row;
  });
  notifyMenuChanged();
  return { status: 200 as const, deal: updated };
}

export async function setDishVisibility(req: Request, id: string, visible: boolean) {
  const prior = await prisma.menuItem.findUnique({ where: { id } });
  if (!prior) return { status: 404 as const, error: "Dish not found." };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.menuItem.update({
      where: { id },
      data: { isVisible: visible },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.ITEM_VISIBILITY_CHANGED,
      entityType: "menu_item",
      entityId: id,
      before: { isVisible: prior.isVisible },
      after: { isVisible: visible },
      ip: clientIp(req),
    });
    return row;
  });
  notifyMenuChanged();
  return { status: 200 as const, item: updated };
}

export async function archiveMenuItem(req: Request, id: string, archive: boolean) {
  const prior = await prisma.menuItem.findUnique({ where: { id } });
  if (!prior) return { status: 404 as const, error: "Dish not found." };
  const archivedAt = archive ? new Date() : null;
  await prisma.$transaction(async (tx) => {
    await tx.menuItem.update({ where: { id }, data: { archivedAt } });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: archive ? AuditAction.MENU_ITEM_ARCHIVED : AuditAction.MENU_ITEM_RESTORED,
      entityType: "menu_item",
      entityId: id,
      before: { archivedAt: prior.archivedAt },
      after: { archivedAt },
      ip: clientIp(req),
    });
  });
  notifyMenuChanged();
  return { status: 200 as const, ok: true };
}

export async function deleteMenuItemIfAllowed(req: Request, id: string) {
  const counts = await menuItemUsageCounts(id);
  if (usageBlocksDelete(counts)) {
    return { status: 409 as const, error: "Item is referenced.", usage: counts, suggestArchive: true };
  }
  await prisma.menuItem.delete({ where: { id } });
  notifyMenuChanged();
  return { status: 200 as const, ok: true };
}

export async function duplicateMenuItem(req: Request, id: string) {
  const source = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      optionGroups: { include: { options: true } },
      addons: true,
    },
  });
  if (!source) return { status: 404 as const, error: "Dish not found." };

  const baseName = source.name.slice(0, DISH_NAME_MAX - 6);
  let name = `${baseName} (copy)`;
  let n = 2;
  while (!(await validateDishNameUnique(name, source.category))) {
    name = `${baseName} (${n})`;
    n++;
  }

  const maxOrder = await prisma.menuItem.aggregate({
    where: { category: source.category },
    _max: { sortOrder: true },
  });

  const created = await prisma.menuItem.create({
    data: {
      name,
      description: source.description.slice(0, DISH_DESC_MAX),
      price: source.price,
      discountPrice: source.discountPrice,
      category: source.category,
      imageUrl: source.imageUrl,
      thumbnailUrl: source.thumbnailUrl,
      sku: source.sku,
      tags: source.tags,
      allergens: source.allergens,
      prepMinutes: source.prepMinutes,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      printStationId: source.printStationId,
      isVisible: source.isVisible,
      isAvailable: true,
    },
  });

  for (const g of source.optionGroups) {
    const group = await prisma.menuItemOptionGroup.create({
      data: {
        menuItemId: created.id,
        name: g.name,
        required: g.required,
        sortOrder: g.sortOrder,
      },
    });
    for (const o of g.options) {
      await prisma.menuItemOption.create({
        data: {
          groupId: group.id,
          name: o.name,
          price: o.price,
          discountPrice: o.discountPrice,
          sortOrder: o.sortOrder,
        },
      });
    }
  }
  for (const a of source.addons) {
    await prisma.menuItemAddon.create({
      data: { menuItemId: created.id, name: a.name, price: a.price, sortOrder: a.sortOrder },
    });
  }

  notifyMenuChanged();
  return { status: 201 as const, id: created.id };
}

export async function reorderDishesInCategory(category: string, orderedIds: string[], req: Request) {
  const items = await prisma.menuItem.findMany({
    where: { category, id: { in: orderedIds } },
    select: { id: true },
  });
  if (items.length !== orderedIds.length) {
    return { status: 400 as const, error: "Invalid dish ids for category." };
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.menuItem.update({ where: { id }, data: { sortOrder: index + 1 } })
    )
  );
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.MENU_REORDERED,
    entityType: "menu_category",
    entityId: category,
    before: {},
    after: { orderedIds },
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const, ok: true };
}
