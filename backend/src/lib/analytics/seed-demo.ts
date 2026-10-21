import {
  FulfillmentType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
} from "@prisma/client";

const ORDER_PREFIX = "ANL-";

const GUESTS = [
  { name: "Ali Khan", phone: "03001111001", email: "ali@demo.local" },
  { name: "Sara Ahmed", phone: "03001111002", email: "sara@demo.local" },
  { name: "Hassan Raza", phone: "03001111003", email: null },
  { name: "Fatima Noor", phone: "03001111004", email: "fatima@demo.local" },
  { name: "Omar Siddiqui", phone: "03001111005", email: null },
  { name: "Ayesha Malik", phone: "03001111006", email: "ayesha@demo.local" },
  { name: "Bilal Hussain", phone: "03001111007", email: null },
  { name: "Zainab Iqbal", phone: "03001111008", email: "zainab@demo.local" },
];

const COMPLETED: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.COLLECTED, OrderStatus.SERVED];

function atDayOffset(daysAgo: number, hour: number, minute: number) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pickCompletedStatus(i: number): OrderStatus {
  const r = i % 10;
  if (r < 5) return OrderStatus.DELIVERED;
  if (r < 8) return OrderStatus.COLLECTED;
  return OrderStatus.SERVED;
}

export async function seedAnalyticsDemo(
  prisma: PrismaClient,
  branchId: string,
  riderId?: string | null
): Promise<{ created: number; deleted: number }> {
  const existing = await prisma.order.findMany({
    where: { orderNumber: { startsWith: ORDER_PREFIX } },
    select: { id: true },
  });
  if (existing.length) {
    await prisma.orderFeedback.deleteMany({ where: { orderId: { in: existing.map((o) => o.id) } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: existing.map((o) => o.id) } } });
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    select: { id: true, name: true, price: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  if (menuItems.length < 3) {
    return { created: 0, deleted: existing.length };
  }

  /** Never sold in demo data — shows zero-qty rows on menu engineering. */
  const zeroSaleIds = new Set(menuItems.slice(0, Math.min(3, menuItems.length)).map((m) => m.id));

  const coupon = await prisma.coupon.findFirst({ where: { code: "WELCOME10" }, select: { id: true, code: true } });
  const city =
    (await prisma.storeSettings.findUnique({ where: { id: "default" }, select: { city: true } }))?.city ?? "Lahore";

  let seq = 1000;
  let created = 0;

  for (let daysAgo = 0; daysAgo <= 74; daysAgo++) {
    const dow = atDayOffset(daysAgo, 12, 0).getDay();
    const isWeekend = dow === 5 || dow === 6;
    const ordersToday = isWeekend ? 3 + (daysAgo % 2) : 1 + (daysAgo % 3);

    for (let j = 0; j < ordersToday; j++) {
      const i = created;
      const guest = GUESTS[i % GUESTS.length];
      const hour = [12, 13, 14, 19, 20, 21, 22][(i + j + daysAgo) % 7];
      const minute = (i * 7 + j * 11) % 50;
      const createdAt = atDayOffset(daysAgo, hour, minute);

      let status: OrderStatus;
      if (daysAgo === 0 && j === 0) status = OrderStatus.CONFIRMED;
      else if (daysAgo === 0 && j === 1) status = OrderStatus.PREPARING;
      else if (i % 14 === 0) status = OrderStatus.CANCELLED;
      else status = pickCompletedStatus(i);

      const fulfillment =
        i % 11 === 0
          ? FulfillmentType.DINE_IN
          : i % 5 === 0
            ? FulfillmentType.PICKUP
            : FulfillmentType.DELIVERY;

      const orderSource = i % 6 === 0 ? OrderSource.POS : OrderSource.ONLINE;
      const paymentMethod = i % 3 === 0 ? PaymentMethod.CARD : PaymentMethod.CASH;

      const lineCount = 1 + (i % 3);
      const lines = [];
      for (let L = 0; L < lineCount; L++) {
        let pick = (i + L + daysAgo) % menuItems.length;
        let item = menuItems[pick];
        let guard = 0;
        while (zeroSaleIds.has(item.id) && guard < menuItems.length) {
          pick = (pick + 1) % menuItems.length;
          item = menuItems[pick];
          guard += 1;
        }
        const qty =
          item.id === menuItems[3 % menuItems.length]?.id
            ? 3 + (i % 2)
            : item.id === menuItems[4 % menuItems.length]?.id
              ? 2
              : 1 + ((i + L) % 2);
        lines.push({
          menuItemId: item.id,
          quantity: qty,
          priceAtOrder: item.price,
          nameAtOrder: item.name,
        });
      }

      let subtotal = lines.reduce((s, l) => s + Number(l.priceAtOrder) * l.quantity, 0);
      const deliveryCharge = fulfillment === FulfillmentType.DELIVERY ? 120 : 0;
      let discountAmount = 0;
      let couponId: string | null = null;
      let couponCode: string | null = null;
      if (coupon && i % 9 === 0 && subtotal >= 500) {
        discountAmount = Math.min(300, Math.round(subtotal * 0.1));
        couponId = coupon.id;
        couponCode = coupon.code;
      }
      const total = subtotal + deliveryCharge - discountAmount;

      seq += 1;
      const orderNumber = `${ORDER_PREFIX}${seq}`;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          branchId,
          riderId: status === OrderStatus.DELIVERED && fulfillment === FulfillmentType.DELIVERY ? riderId ?? undefined : undefined,
          status,
          orderSource,
          fulfillmentType: fulfillment,
          paymentMethod,
          subtotal,
          deliveryCharge,
          discountAmount,
          total,
          couponId,
          couponCode,
          deliveryAddress:
            fulfillment === FulfillmentType.DINE_IN
              ? "Dine-in — table service"
              : `${10 + (i % 40)} Demo Street, ${city}`,
          customerName: guest.name,
          customerPhone: guest.phone,
          customerEmail: guest.email,
          createdAt,
          updatedAt: createdAt,
          items: { create: lines },
          events:
            status === OrderStatus.CANCELLED
              ? {
                  create: {
                    fromStatus: OrderStatus.CONFIRMED,
                    toStatus: OrderStatus.CANCELLED,
                    reason: i % 2 === 0 ? "Customer changed plans" : "Out of stock",
                  },
                }
              : undefined,
        },
      });

      if (COMPLETED.includes(status) && i % 4 === 0) {
        const rating = [5, 5, 4, 4, 3, 2, 5, 4][i % 8];
        await prisma.orderFeedback.create({
          data: {
            orderId: order.id,
            rating,
            comment: rating >= 4 ? "Great food, fast service." : "Okay, could be faster.",
            createdAt,
          },
        });
      }

      created += 1;
    }
  }

  return { created, deleted: existing.length };
}
