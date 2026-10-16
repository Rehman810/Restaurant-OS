import { applyOrderDiscount, quoteCharges } from "./charges";
import type { getStoreSettings } from "./settings-data";
import type { prisma } from "./prisma";

type Tx = Pick<typeof prisma, "order">;

export async function recalculateOrderTotals(
  tx: Tx,
  orderId: string,
  settings: Awaited<ReturnType<typeof getStoreSettings>>
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });
  const subtotal = order.items.reduce(
    (sum, i) => sum + Number(i.priceAtOrder) * i.quantity,
    0
  );
  const delivery = Number(order.deliveryCharge);
  const quoted = quoteCharges(subtotal, delivery, settings);
  const discounted = applyOrderDiscount(
    quoted,
    order.discountPercent != null ? Number(order.discountPercent) : null,
    Number(order.discountAmount)
  );
  return tx.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      taxAmount: quoted.tax,
      serviceAmount: quoted.service,
      discountAmount: discounted.discountAmount,
      total: discounted.total,
    },
  });
}
