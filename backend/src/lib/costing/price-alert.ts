import crypto from "crypto";
import { prisma } from "../prisma";
import { getStoreSettings } from "../settings-data";
import { emitOpsNotification } from "../realtime";
import { costingSettingsFromStore, roundPercent1 } from "./math";

/** Notify managers when a purchase moves weighted-average cost beyond the configured threshold. */
export async function maybeNotifyIngredientCostChange(input: {
  branchId: string;
  itemId: string;
  itemName: string;
  oldAvg: number;
  newAvg: number;
}) {
  if (input.oldAvg <= 0 || input.newAvg <= 0) return;
  const settings = costingSettingsFromStore(await getStoreSettings());
  const pct = ((input.newAvg - input.oldAvg) / input.oldAvg) * 100;
  if (Math.abs(pct) < settings.ingredientPriceChangeAlertPercent) return;

  const lines = await prisma.recipeLine.findMany({
    where: { itemId: input.itemId },
    include: { menuItem: { select: { name: true } } },
  });
  const names = lines.map((l) => l.menuItem.name);
  emitOpsNotification({
    id: crypto.randomUUID(),
    at: Date.now(),
    kind: "inventory_low_stock",
    title: "Ingredient cost changed",
    message: `${input.itemName} cost ${pct > 0 ? "rose" : "fell"} ${roundPercent1(Math.abs(pct))}%; ${names.length} dish${names.length === 1 ? "" : "es"} affected`,
    severity: "warning",
    branchId: input.branchId,
    href: "/admin/reports/dish-costing",
    meta: { ingredientId: input.itemId, dishCount: names.length },
  });
}
