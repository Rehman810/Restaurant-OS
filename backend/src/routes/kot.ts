import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ORDER_OPS } from "../lib/roles";
import { getStoreSettings } from "../lib/settings-data";
import { storeNameFrom } from "../lib/branding";
import { buildKotTickets } from "../lib/kot";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";

export const kotRouter = Router();

kotRouter.get("/orders/:orderId", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: {
      items: {
        include: {
          menuItem: { select: { printStationId: true } },
        },
      },
    },
  });
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (!scope.allBranches && order.branchId && order.branchId !== scope.branchId) {
    return res.status(403).json({ error: "Order is outside your branch." });
  }

  const branchId = order.branchId || (scope.allBranches ? await getDefaultBranchId() : scope.branchId!);
  const stations = await prisma.printStation.findMany({
    where: { branchId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isDefault: true },
  });

  const lines = order.items.map((item) => ({
    id: item.id,
    menuItemId: item.menuItemId,
    quantity: item.quantity,
    nameAtOrder: item.nameAtOrder,
    optionsLabel: item.optionsLabel,
    instructions: item.instructions,
    printStationId: item.menuItem.printStationId,
  }));

  const tickets = buildKotTickets(lines, stations);
  const settings = await getStoreSettings();

  res.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      tableNumber: order.tableNumber,
      notes: order.notes,
      createdAt: order.createdAt,
    },
    store: {
      name: storeNameFrom(settings),
      phone: settings.phone,
      address: settings.address,
    },
    tickets,
  });
});
