import type { Request } from "express";
import { prisma } from "../prisma";
import { writeAudit } from "../audit";
import { AuditAction } from "../audit-actions";
import { clientIp } from "../client-ip";
import { BULK_MAX_IDS } from "./constants";
import { notifyMenuChanged } from "./emit";
import { soldOutPatchToRow, type SoldOutPatchInput } from "./availability";
import { archiveMenuItem, setDishVisibility } from "./mutations";

export type BulkAction =
  | { action: "setAvailability"; payload: SoldOutPatchInput }
  | { action: "setVisibility"; visible: boolean }
  | { action: "moveCategory"; category: string }
  | { action: "adjustPrice"; mode: "percent" | "fixed"; value: number; dryRun?: boolean }
  | { action: "archive" };

export async function runMenuBulk(
  req: Request,
  ids: string[],
  action: BulkAction,
  branchId: string,
  timezone: string
) {
  if (!ids.length) return { status: 400 as const, error: "No ids provided." };
  if (ids.length > BULK_MAX_IDS) return { status: 400 as const, error: `Max ${BULK_MAX_IDS} items per bulk run.` };

  const results: { id: string; ok: boolean; error?: string; preview?: unknown }[] = [];

  if (action.action === "adjustPrice" && action.dryRun) {
    const items = await prisma.menuItem.findMany({ where: { id: { in: ids } }, select: { id: true, price: true } });
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      const oldPrice = Number(item.price);
      const next =
        action.mode === "percent"
          ? Math.round(oldPrice * (1 + action.value / 100) * 100) / 100
          : Math.round((oldPrice + action.value) * 100) / 100;
      results.push({ id, ok: true, preview: { oldPrice, newPrice: Math.max(0.01, next) } });
    }
    return { status: 200 as const, dryRun: true, results };
  }

  for (const id of ids) {
    try {
      if (action.action === "setAvailability") {
        const rowData = soldOutPatchToRow(action.payload, timezone);
        if (action.payload.state === "available") {
          await prisma.menuItemBranchAvailability.deleteMany({ where: { menuItemId: id, branchId } });
        } else {
          await prisma.menuItemBranchAvailability.upsert({
            where: { menuItemId_branchId: { menuItemId: id, branchId } },
            create: { menuItemId: id, branchId, ...rowData, setById: req.user!.id },
            update: { ...rowData, setById: req.user!.id, setAt: new Date() },
          });
        }
        results.push({ id, ok: true });
      } else if (action.action === "setVisibility") {
        const r = await setDishVisibility(req, id, action.visible);
        results.push({ id, ok: r.status === 200, error: r.status !== 200 ? r.error : undefined });
      } else if (action.action === "moveCategory") {
        await prisma.menuItem.update({ where: { id }, data: { category: action.category } });
        results.push({ id, ok: true });
      } else if (action.action === "adjustPrice") {
        const item = await prisma.menuItem.findUnique({ where: { id }, select: { price: true } });
        if (!item) {
          results.push({ id, ok: false, error: "Not found" });
          continue;
        }
        const oldPrice = Number(item.price);
        const next =
          action.mode === "percent"
            ? Math.round(oldPrice * (1 + action.value / 100) * 100) / 100
            : Math.round((oldPrice + action.value) * 100) / 100;
        const newPrice = Math.max(0.01, next);
        await prisma.$transaction(async (tx) => {
          await tx.menuItem.update({ where: { id }, data: { price: newPrice } });
          await writeAudit(tx, {
            actorId: req.user!.id,
            actorRole: req.user!.role,
            action: AuditAction.ITEM_PRICE_CHANGED,
            entityType: "menu_item",
            entityId: id,
            before: { price: oldPrice },
            after: { price: newPrice, bulk: true },
            ip: clientIp(req),
          });
        });
        results.push({ id, ok: true });
      } else if (action.action === "archive") {
        const r = await archiveMenuItem(req, id, true);
        results.push({ id, ok: r.status === 200, error: r.status !== 200 ? r.error : undefined });
      }
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.MENU_BULK_ACTION,
    entityType: "menu_bulk",
    entityId: ids.join(","),
    before: {},
    after: { action, results },
    ip: clientIp(req),
  });

  notifyMenuChanged([branchId]);
  return { status: 200 as const, results };
}
