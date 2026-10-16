import type { PosLine } from "@/lib/pos-cart";
import type { FulfillmentType, Order } from "@/lib/types";

export function buildOfflinePrintOrder(params: {
  offlineLabel: string;
  lines: PosLine[];
  total: number;
  subtotal: number;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone?: string;
  tableNumber?: string;
  notes?: string;
}): Order {
  const now = new Date().toISOString();
  return {
    id: `offline-${params.offlineLabel}`,
    orderNumber: params.offlineLabel,
    status: "CONFIRMED",
    orderSource: "POS",
    fulfillmentType: params.fulfillmentType,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    subtotal: params.subtotal,
    total: params.total,
    deliveryAddress: params.fulfillmentType === "DINE_IN" ? `Dine-in · Table ${params.tableNumber || "—"}` : "Takeaway",
    customerName: params.customerName,
    customerPhone: params.customerPhone || "",
    tableNumber: params.tableNumber || null,
    notes: params.notes || null,
    createdAt: now,
    items: params.lines.map((l) => ({
      id: l.id,
      menuItemId: l.menuItemId || l.dealId || l.id,
      quantity: l.quantity,
      priceAtOrder: l.price,
      nameAtOrder: l.name,
      optionsLabel: l.optionsLabel || "",
      instructions: l.instructions || "",
    })),
  };
}
