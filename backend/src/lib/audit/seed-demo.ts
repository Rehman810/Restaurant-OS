import { OrderStatus, Prisma, PrismaClient, Role } from "@prisma/client";
import { AuditAction } from "../audit-actions";

const IDS = {
  login: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  price: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
  discount: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
  cancel: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
  refund: "aaaaaaaa-aaaa-4aaa-8aaa-000000000005",
  reprint: "aaaaaaaa-aaaa-4aaa-8aaa-000000000006",
  block: "aaaaaaaa-aaaa-4aaa-8aaa-000000000007",
  shift: "aaaaaaaa-aaaa-4aaa-8aaa-000000000008",
  rider: "aaaaaaaa-aaaa-4aaa-8aaa-000000000009",
  system: "aaaaaaaa-aaaa-4aaa-8aaa-00000000000a",
  legacy: "aaaaaaaa-aaaa-4aaa-8aaa-00000000000b",
} as const;

export async function seedAuditLogDemo(prisma: PrismaClient, branchId: string) {
  const existing = await prisma.auditLog.findFirst({
    where: { id: IDS.login },
    select: { id: true },
  });
  if (existing) return { created: 0, skipped: true };

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "admin@admin.com",
          "manager@demo.restaurant",
          "cashier@demo.restaurant",
          "chef@demo.restaurant",
          "rider@demo.restaurant",
        ],
      },
    },
    select: { id: true, name: true, email: true, role: true },
  });
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const admin = byEmail.get("admin@admin.com");
  const manager = byEmail.get("manager@demo.restaurant");
  const cashier = byEmail.get("cashier@demo.restaurant");
  const chef = byEmail.get("chef@demo.restaurant");
  const rider = byEmail.get("rider@demo.restaurant");
  if (!admin || !manager || !cashier || !chef || !rider) {
    return { created: 0, skipped: true, reason: "demo users missing" };
  }

  const order =
    (await prisma.order.findFirst({
      where: { branchId, orderNumber: { startsWith: "CUS-" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true },
    })) ??
    (await prisma.order.findFirst({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderNumber: true },
    }));

  const dish = await prisma.menuItem.findFirst({
    where: { archivedAt: null },
    select: { id: true, name: true, price: true },
  });

  const daysAgo = (d: number, hour = 12) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(hour, 15, 0, 0);
    return t;
  };

  const rows: Prisma.AuditLogCreateManyInput[] = [
    {
      id: IDS.login,
      createdAt: daysAgo(13, 9),
      actorId: admin.id,
      actorRole: Role.ADMIN,
      branchId,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: "user",
      entityId: admin.id,
      entityLabel: admin.name,
    },
    {
      id: IDS.price,
      createdAt: daysAgo(11, 14),
      actorId: manager.id,
      actorRole: Role.MANAGER,
      branchId,
      action: AuditAction.ITEM_PRICE_CHANGED,
      entityType: "menu_item",
      entityId: dish?.id ?? IDS.price,
      entityLabel: dish?.name ?? "Demo dish",
      before: { price: dish?.price ?? 500 },
      after: { price: Number(dish?.price ?? 500) + 50 },
    },
    {
      id: IDS.discount,
      createdAt: daysAgo(9, 18),
      actorId: cashier.id,
      actorRole: Role.CASHIER,
      branchId,
      action: AuditAction.DISCOUNT_APPLIED,
      entityType: "order",
      entityId: order?.id ?? IDS.discount,
      entityLabel: order?.orderNumber ?? "ORD-DEMO",
      after: { discountPercent: 10, discountAmount: 120 },
      reason: "MANAGER_COMP",
    },
    {
      id: IDS.cancel,
      createdAt: daysAgo(7, 20),
      actorId: manager.id,
      actorRole: Role.MANAGER,
      branchId,
      action: AuditAction.ORDER_CANCELLED,
      entityType: "order",
      entityId: order?.id ?? IDS.cancel,
      entityLabel: order?.orderNumber ?? "ORD-DEMO",
      before: { from: OrderStatus.PREPARING, status: OrderStatus.PREPARING },
      after: { to: OrderStatus.CANCELLED, status: OrderStatus.CANCELLED },
      reason: "KITCHEN_DELAY",
    },
    {
      id: IDS.refund,
      createdAt: daysAgo(6, 11),
      actorId: cashier.id,
      actorRole: Role.CASHIER,
      branchId,
      action: AuditAction.REFUND_ISSUED,
      entityType: "order",
      entityId: order?.id ?? IDS.cancel,
      entityLabel: order?.orderNumber ?? "ORD-DEMO",
      after: { refundAmount: 850 },
      reason: "WRONG_ORDER",
    },
    {
      id: IDS.reprint,
      createdAt: daysAgo(5, 21),
      actorId: chef.id,
      actorRole: Role.CHEF,
      branchId,
      action: AuditAction.ORDER_KOT_REPRINTED,
      entityType: "order",
      entityId: order?.id ?? IDS.cancel,
      entityLabel: order?.orderNumber ?? "ORD-DEMO",
      after: { kotPrint: true, isReprint: true },
    },
    {
      id: IDS.block,
      createdAt: daysAgo(4, 16),
      actorId: admin.id,
      actorRole: Role.ADMIN,
      branchId: null,
      action: AuditAction.CUSTOMER_BLOCKED,
      entityType: "customer",
      entityId: IDS.block,
      entityLabel: "Guest · ***8822",
      after: { phone: "+923001112233" },
      reason: "Repeated no-shows",
    },
    {
      id: IDS.shift,
      createdAt: daysAgo(2, 23),
      actorId: cashier.id,
      actorRole: Role.CASHIER,
      branchId,
      action: AuditAction.SHIFT_CLOSED,
      entityType: "cash_shift",
      entityId: IDS.shift,
      entityLabel: "Shift · demo",
      before: { openingCash: 5000 },
      after: { openingCash: 5000, expectedCash: 42800, countedCash: 42550, variance: -250 },
    },
    {
      id: IDS.rider,
      createdAt: daysAgo(1, 19),
      actorId: manager.id,
      actorRole: Role.MANAGER,
      branchId,
      action: AuditAction.RIDER_CASH_SETTLED,
      entityType: "rider_settlement",
      entityId: IDS.rider,
      entityLabel: rider.name,
      after: { riderId: rider.id, receivedTotal: 3200, amount: 3200 },
    },
    {
      id: IDS.system,
      createdAt: daysAgo(0, 6),
      actorId: null,
      actorRole: null,
      branchId,
      action: AuditAction.RESERVATION_NO_SHOW_AUTO,
      entityType: "Reservation",
      entityId: IDS.system,
      entityLabel: "Walk-in hold expired",
      meta: { source: "scheduler" },
      after: { source: "scheduler" },
    },
    {
      id: IDS.legacy,
      createdAt: daysAgo(8, 10),
      actorId: cashier.id,
      actorRole: Role.CASHIER,
      branchId,
      action: "ORDER_STATUS_CHANGED",
      entityType: "order",
      entityId: order?.id ?? IDS.cancel,
      entityLabel: order?.orderNumber ?? "ORD-DEMO",
      before: { status: OrderStatus.CONFIRMED },
      after: { status: OrderStatus.PREPARING },
    },
  ];

  await prisma.auditLog.createMany({ data: rows, skipDuplicates: true });
  return { created: rows.length, skipped: false };
}
