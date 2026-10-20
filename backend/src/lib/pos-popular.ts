import { OrderSource, OrderStatus } from "@prisma/client";
import { prisma } from "./prisma";

export async function posPopularMenuItemIds(branchId: string, days = 30, limit = 12) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: {
        branchId,
        orderSource: OrderSource.POS,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: since },
      },
    },
    _sum: { quantity: true },
  });

  return rows
    .map((r) => ({
      menuItemId: r.menuItemId!,
      quantity: Number(r._sum.quantity ?? 0),
    }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}
