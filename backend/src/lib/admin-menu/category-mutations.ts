import type { Request } from "express";
import { prisma } from "../prisma";
import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { clientIp } from "../client-ip";
import { enrichCategory } from "../category-meta";
import { notifyMenuChanged } from "./emit";
import { categoryUsageDishCount } from "./usage";

export async function setCategoryVisibility(req: Request, id: string, visible: boolean) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return { status: 404 as const, error: "Category not found." };
  await prisma.category.update({ where: { id }, data: { isVisible: visible } });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CATEGORY_CHANGED,
    entityType: "category",
    entityId: id,
    before: { isVisible: cat.isVisible },
    after: { isVisible: visible },
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const };
}

export async function archiveCategory(req: Request, id: string, archive: boolean) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return { status: 404 as const, error: "Category not found." };
  await prisma.category.update({
    where: { id },
    data: { archivedAt: archive ? new Date() : null, ...(archive ? { isVisible: false } : {}) },
  });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CATEGORY_CHANGED,
    entityType: "category",
    entityId: id,
    before: { archivedAt: cat.archivedAt },
    after: { archivedAt: archive ? "now" : null },
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const };
}

export async function reorderCategories(req: Request, orderedIds: string[]) {
  const cats = await prisma.category.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true },
  });
  if (cats.length !== orderedIds.length) {
    return { status: 400 as const, error: "Invalid category ids." };
  }
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.category.update({ where: { id }, data: { sortOrder: index + 1 } }))
  );
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.MENU_REORDERED,
    entityType: "category",
    entityId: "menu",
    before: {},
    after: { orderedIds },
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const };
}

export async function deleteCategory(req: Request, id: string, moveToCategoryId?: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return { status: 404 as const, error: "Category not found." };

  const dishCount = await categoryUsageDishCount(category.name);
  if (dishCount > 0) {
    if (!moveToCategoryId) {
      return {
        status: 400 as const,
        error: `${dishCount} dish(es) use this category. Choose a category to move them to.`,
        dishCount,
        requiresMoveTo: true,
      };
    }
    const target = await prisma.category.findUnique({ where: { id: moveToCategoryId } });
    if (!target || target.id === id) {
      return { status: 400 as const, error: "Invalid target category." };
    }
    await prisma.menuItem.updateMany({
      where: { category: category.name },
      data: { category: target.name },
    });
  }

  await prisma.category.delete({ where: { id } });
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CATEGORY_CHANGED,
    entityType: "category",
    entityId: id,
    before: { name: category.name, dishCount },
    after: moveToCategoryId ? { movedTo: moveToCategoryId } : {},
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const };
}

export function parseCategoryScheduleBody(body: Record<string, unknown>) {
  const scheduleDays = Array.isArray(body.scheduleDays)
    ? body.scheduleDays.map(Number).filter((d) => d >= 0 && d <= 6)
    : undefined;
  const scheduleStartMinutes =
    body.scheduleStartTime != null && String(body.scheduleStartTime).includes(":")
      ? timeToMinutes(String(body.scheduleStartTime))
      : body.scheduleStartMinutes !== undefined
        ? body.scheduleStartMinutes === null
          ? null
          : Number(body.scheduleStartMinutes)
        : undefined;
  const scheduleEndMinutes =
    body.scheduleEndTime != null && String(body.scheduleEndTime).includes(":")
      ? timeToMinutes(String(body.scheduleEndTime))
      : body.scheduleEndMinutes !== undefined
        ? body.scheduleEndMinutes === null
          ? null
          : Number(body.scheduleEndMinutes)
        : undefined;

  return { scheduleDays, scheduleStartMinutes, scheduleEndMinutes };
}

function timeToMinutes(hhmm: string): number | undefined {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
  return h * 60 + m;
}

export async function updateCategoryFields(
  req: Request,
  id: string,
  data: {
    name?: string;
    tagline?: string;
    imageUrl?: string;
    isVisible?: boolean;
    scheduleDays?: number[];
    scheduleStartMinutes?: number | null;
    scheduleEndMinutes?: number | null;
  }
) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return { status: 404 as const, error: "Category not found." };

  const name = data.name !== undefined ? String(data.name).trim() : undefined;
  if (name !== undefined && !name) {
    return { status: 400 as const, error: "Category name is required." };
  }

  if (name && name !== category.name) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return { status: 409 as const, error: "Category name already exists." };
    await prisma.menuItem.updateMany({
      where: { category: category.name },
      data: { category: name },
    });
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(data.tagline !== undefined ? { tagline: String(data.tagline).trim() } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: String(data.imageUrl).trim() } : {}),
      ...(data.isVisible !== undefined ? { isVisible: data.isVisible } : {}),
      ...(data.scheduleDays !== undefined ? { scheduleDays: data.scheduleDays } : {}),
      ...(data.scheduleStartMinutes !== undefined ? { scheduleStartMinutes: data.scheduleStartMinutes } : {}),
      ...(data.scheduleEndMinutes !== undefined ? { scheduleEndMinutes: data.scheduleEndMinutes } : {}),
    },
  });

  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.CATEGORY_CHANGED,
    entityType: "category",
    entityId: id,
    before: { name: category.name },
    after: { name: updated.name },
    ip: clientIp(req),
  });
  notifyMenuChanged();
  return { status: 200 as const, category: enrichCategory(updated) };
}
