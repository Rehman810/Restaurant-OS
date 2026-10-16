import { PaymentMethod } from "@prisma/client";
import { applyOrderDiscount, quoteCharges } from "./charges";
import { enrichLinesWithTax } from "./tax/apply";
import type { getStoreSettings } from "./settings-data";
import type { prisma } from "./prisma";

type Tx = Pick<typeof prisma, "order" | "orderItem">;

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
  const taxCtx = {
    fulfillmentType: order.fulfillmentType,
    paymentMethod: order.paymentMethod ?? PaymentMethod.CASH,
  };
  const lineInputs = order.items.map((i) => ({
    menuItemId: i.menuItemId,
    quantity: i.quantity,
    priceAtOrder: Number(i.priceAtOrder),
    nameAtOrder: i.nameAtOrder,
    optionsLabel: i.optionsLabel,
    instructions: i.instructions,
  }));
  const enriched = enrichLinesWithTax(lineInputs, settings, taxCtx);
  const quoted = quoteCharges(subtotal, delivery, settings, taxCtx);
  const discounted = applyOrderDiscount(
    quoted,
    order.discountPercent != null ? Number(order.discountPercent) : null,
    Number(order.discountAmount)
  );

  for (let i = 0; i < order.items.length; i++) {
    const taxLine = enriched.lines[i];
    if (!taxLine) continue;
    await tx.orderItem.update({
      where: { id: order.items[i]!.id },
      data: {
        lineTaxableAmount: taxLine.lineTaxableAmount,
        lineTaxAmount: taxLine.lineTaxAmount,
        lineTaxRatePercent: taxLine.lineTaxRatePercent,
      },
    });
  }

  return tx.order.update({
    where: { id: orderId },
    data: {
      subtotal,
      taxAmount: quoted.tax,
      taxableAmount: enriched.orderTax.taxableAmount,
      taxRatePercentSnap: enriched.orderTax.taxRatePercentSnap,
      taxInclusiveSnap: enriched.orderTax.taxInclusiveSnap,
      taxSnapshotJson: enriched.orderTax.taxSnapshotJson,
      serviceAmount: quoted.service,
      discountAmount: discounted.discountAmount,
      total: discounted.total,
    },
  });
}
