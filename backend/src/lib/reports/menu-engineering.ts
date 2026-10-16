import { OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { buildDishCostingReport } from "./dish-costing";

export type MenuEngineeringClass = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

function classify(qty: number, marginPct: number, medianQty: number, medianMargin: number): MenuEngineeringClass {
  const highVol = qty >= medianQty;
  const highMargin = marginPct >= medianMargin;
  if (highVol && highMargin) return "STAR";
  if (highVol && !highMargin) return "PLOWHORSE";
  if (!highVol && highMargin) return "PUZZLE";
  return "DOG";
}

export async function buildMenuEngineeringReport(
  branchId: string,
  startUtc: Date,
  endUtc: Date,
  categoryFilter?: string
) {
  const costing = await buildDishCostingReport(branchId, categoryFilter);
  const costByMenu = new Map(costing.map((c) => [c.menuItemId, c]));

  const sales = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      menuItemId: { not: undefined },
      order: {
        branchId,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: startUtc, lte: endUtc },
      },
    },
    _sum: { quantity: true },
    _count: { id: true },
  });

  const rows = sales
    .map((s) => {
      const menuItemId = s.menuItemId!;
      const cost = costByMenu.get(menuItemId);
      const qty = Number(s._sum.quantity ?? 0);
      const marginPct = cost?.marginPercent ?? 0;
      const revenue = cost?.price != null ? Number(cost.price) * qty : 0;
      return {
        menuItemId,
        name: cost?.name ?? "Unknown item",
        category: cost?.category ?? "Other",
        quantitySold: qty,
        revenue: Math.round(revenue * 100) / 100,
        marginPercent: cost?.marginPercent,
        foodCostPercent: cost?.foodCostPercent,
        costStatus: cost?.costStatus ?? "unknown",
        marginPctForClass: cost?.marginPercent ?? 0,
      };
    })
    .filter((r) => r.quantitySold > 0);

  const qtys = rows.map((r) => r.quantitySold).sort((a, b) => a - b);
  const margins = rows.map((r) => r.marginPctForClass).sort((a, b) => a - b);
  const medianQty = qtys.length ? qtys[Math.floor(qtys.length / 2)] : 0;
  const medianMargin = margins.length ? margins[Math.floor(margins.length / 2)] : 0;

  return rows
    .map((r) => ({
      ...r,
      classification: classify(r.quantitySold, r.marginPctForClass, medianQty, medianMargin),
      medianQty,
      medianMarginPercent: Math.round(medianMargin * 10) / 10,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold);
}
