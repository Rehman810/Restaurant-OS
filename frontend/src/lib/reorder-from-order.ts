import { fetchAllDeals, fetchAllMenuItems } from "./catalog-api";
import { Deal, MenuItem, Order } from "./types";

type CartApi = {
  addConfigured: (opts: {
    item: MenuItem;
    price: number;
    quantity?: number;
    optionsLabel?: string;
    instructions?: string;
  }) => void;
  addDeal: (deal: Deal, opts?: { openDrawer?: boolean }) => void;
};

export async function fillCartFromOrder(order: Order, cart: CartApi) {
  const [menu, deals] = await Promise.all([
    fetchAllMenuItems().catch(() => []),
    fetchAllDeals(true).catch(() => []),
  ]);

  const addedDeals = new Set<string>();
  for (const line of order.items) {
    if (line.nameAtOrder.includes(" · ")) {
      const dealTitle = line.nameAtOrder.split(" · ")[0];
      const deal = deals.find((d: Deal) => d.title === dealTitle);
      if (!deal || addedDeals.has(deal.id)) continue;
      const anchor = deal.items[0];
      const matching = order.items.find(
        (l) => l.menuItemId === anchor?.menuItemId && l.nameAtOrder.startsWith(`${dealTitle} ·`)
      );
      const dealQty = matching && anchor
        ? Math.max(1, Math.round(matching.quantity / anchor.quantity))
        : 1;
      for (let i = 0; i < dealQty; i++) cart.addDeal(deal);
      addedDeals.add(deal.id);
      continue;
    }

    const item = menu.find((m) => m.id === line.menuItemId);
    if (!item || !item.isAvailable) continue;
    cart.addConfigured({
      item,
      price: Number(line.priceAtOrder),
      quantity: line.quantity,
      optionsLabel: line.optionsLabel || undefined,
      instructions: line.instructions || undefined,
    });
  }
}
