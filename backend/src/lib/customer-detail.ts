import { OrderStatus } from "@prisma/client";
import { buildCustomerDirectory, customerContactKey, listCustomerOrders } from "./customer-directory";
import { daysSinceLastOrder } from "./customer-segments";
import { prisma } from "./prisma";

export async function getCustomerDirectoryRow(customerId: string, branchId?: string | null) {
  const directory = await buildCustomerDirectory(branchId);
  return directory.find((c) => c.id === customerId) ?? null;
}

export async function getCustomerDetail(customerId: string, branchId?: string | null) {
  const row = await getCustomerDirectoryRow(customerId, branchId);
  if (!row) return null;

  const profile = await prisma.customerAdminProfile.findUnique({
    where: { directoryId: customerId },
    select: { internalNotes: true, updatedAt: true },
  });

  const ordersRes = await listCustomerOrders(customerId, 10, 0, branchId);
  if (!ordersRes) return null;
  const firstOrderAt = await getFirstOrderAt(customerId, branchId);

  const favouriteDishes = await loadFavouriteDishes(customerId, branchId);

  const avgOrderValue =
    row.nonCancelledOrderCount > 0 ? row.totalSpent / row.nonCancelledOrderCount : 0;

  return {
    ...row,
    firstOrderAt,
    lastOrderAt: row.lastOrder?.createdAt ?? null,
    daysSinceLastOrder: daysSinceLastOrder(row.lastOrder?.createdAt ?? null),
    avgOrderValue,
    internalNotes: profile?.internalNotes ?? "",
    notesUpdatedAt: profile?.updatedAt?.toISOString() ?? null,
    recentOrders: ordersRes.orders,
    favouriteDishes,
  };
}

async function loadFavouriteDishes(customerId: string, branchId?: string | null) {
  const branchFilter = branchId ? { branchId } : {};
  let orderIds: string[] = [];

  if (customerId.startsWith("guest:")) {
    const contactKey = customerId.slice("guest:".length);
    const guestOrders = await prisma.order.findMany({
      where: { customerId: null, ...branchFilter },
      select: { id: true, customerPhone: true, customerEmail: true },
    });
    orderIds = guestOrders
      .filter((o) => customerContactKey(o.customerPhone, o.customerEmail) === contactKey)
      .map((o) => o.id);
  } else {
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, phone: true },
    });
    if (!user) return [];
    const ordersRes = await listCustomerOrders(customerId, 500, 0, branchId);
    if (!ordersRes) return [];
    orderIds = ordersRes.orders.map((o) => o.id);
  }

  if (!orderIds.length) return [];

  const items = await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      order: { status: { not: OrderStatus.CANCELLED } },
    },
    select: { nameAtOrder: true, quantity: true },
  });

  const qtyByName = new Map<string, number>();
  for (const item of items) {
    const name = item.nameAtOrder.trim() || "Item";
    qtyByName.set(name, (qtyByName.get(name) ?? 0) + item.quantity);
  }

  return [...qtyByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, quantity]) => ({ name, quantity }));
}

async function getFirstOrderAt(customerId: string, branchId?: string | null) {
  const all = await listCustomerOrders(customerId, 1, 0, branchId);
  if (!all?.total) return null;
  const lastPageOffset = Math.max(0, all.total - 1);
  const oldest = await listCustomerOrders(customerId, 1, lastPageOffset, branchId);
  if (!oldest) return null;
  const first = oldest.orders[0];
  return first ? new Date(first.createdAt) : null;
}

export async function updateCustomerNotes(customerId: string, internalNotes: string) {
  const row = await getCustomerDirectoryRow(customerId, null);
  if (!row) return null;
  const notes = internalNotes.trim().slice(0, 4000);
  const profile = await prisma.customerAdminProfile.upsert({
    where: { directoryId: customerId },
    create: { directoryId: customerId, internalNotes: notes },
    update: { internalNotes: notes },
  });
  return profile;
}
