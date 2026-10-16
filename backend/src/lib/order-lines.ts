import { prisma } from "./prisma";
import { effectiveItemPrice } from "./store-settings";

export type CartItemInput = {
  menuItemId: string;
  quantity: number;
  sizeId?: string;
  optionIds?: string[];
  addonIds?: string[];
  instructions?: string;
  unitPriceOverride?: number;
};

export type CartDealInput = { dealId: string; quantity: number };

export type OrderLine = {
  menuItemId: string;
  quantity: number;
  priceAtOrder: number;
  nameAtOrder: string;
  optionsLabel: string;
  instructions: string;
};

type BuildResult =
  | { ok: true; lines: OrderLine[]; subtotal: number; hadPriceOverride: boolean }
  | { ok: false; error: string; status: number };

export async function buildOrderLines(
  cartItems: CartItemInput[],
  cartDeals: CartDealInput[]
): Promise<BuildResult> {
  if (!cartItems.length && !cartDeals.length) {
    return { ok: false, error: "Cart is empty. Add items first.", status: 400 };
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: cartItems.map((i) => i.menuItemId) } },
    include: {
      sizes: true,
      addons: true,
      optionGroups: { include: { options: true } },
    },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  const lines: OrderLine[] = [];
  let subtotal = 0;
  let hadPriceOverride = false;

  for (const row of cartItems) {
    const menu = byId.get(row.menuItemId);
    if (!menu || !menu.isAvailable) {
      return { ok: false, error: `Item unavailable: ${menu?.name || row.menuItemId}`, status: 400 };
    }
    const qty = Math.max(1, Number(row.quantity) || 1);
    const labels: string[] = [];
    const allOptions = [
      ...menu.optionGroups.flatMap((g) => g.options),
      ...menu.sizes.map((s) => ({ ...s, discountPrice: null as null })),
    ];
    const optionIds = row.optionIds?.length ? row.optionIds : row.sizeId ? [row.sizeId] : [];

    const hasGroups = menu.optionGroups.length > 0 || menu.sizes.length > 0;
    let unitPrice = effectiveItemPrice(menu);

    if (hasGroups && optionIds.length) {
      unitPrice = 0;
      for (const optId of optionIds) {
        const opt = allOptions.find((o) => o.id === optId);
        if (!opt) return { ok: false, error: "Invalid option selected.", status: 400 };
        const optPrice = opt.discountPrice != null ? Number(opt.discountPrice) : Number(opt.price);
        unitPrice += optPrice;
        labels.push(opt.name);
      }
    } else if (hasGroups) {
      const required = menu.optionGroups.filter((g) => g.required);
      if (required.length > 0) {
        return { ok: false, error: `Please select options for ${menu.name}.`, status: 400 };
      }
    }

    for (const addonId of row.addonIds ?? []) {
      const addon = menu.addons.find((a) => a.id === addonId);
      if (!addon) return { ok: false, error: "Invalid add-on selected.", status: 400 };
      unitPrice += Number(addon.price);
      labels.push(addon.name);
    }

    if (row.unitPriceOverride != null && Number.isFinite(Number(row.unitPriceOverride))) {
      const override = Number(row.unitPriceOverride);
      if (Math.abs(override - unitPrice) > 0.009) {
        hadPriceOverride = true;
        unitPrice = override;
      }
    }

    const instructions = String(row.instructions || "").trim().slice(0, 500);
    subtotal += unitPrice * qty;
    lines.push({
      menuItemId: menu.id,
      quantity: qty,
      priceAtOrder: unitPrice,
      nameAtOrder: menu.name,
      optionsLabel: labels.join(", "),
      instructions,
    });
  }

  for (const row of cartDeals) {
    const deal = await prisma.deal.findUnique({
      where: { id: row.dealId },
      include: { items: { include: { menuItem: true } } },
    });
    if (!deal || !deal.isActive) {
      return { ok: false, error: "Deal unavailable.", status: 400 };
    }
    const dealQty = Math.max(1, Number(row.quantity) || 1);
    const dealPrice = Number(deal.dealPrice) * dealQty;
    subtotal += dealPrice;

    const regular = deal.items.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
      0
    );

    for (const item of deal.items) {
      if (!item.menuItem.isAvailable) {
        return { ok: false, error: `${item.menuItem.name} in this deal is unavailable.`, status: 400 };
      }
      const share =
        regular > 0
          ? (Number(item.menuItem.price) * item.quantity) / regular
          : 1 / deal.items.length;
      const lineTotal = dealPrice * share;
      const lineQty = item.quantity * dealQty;
      lines.push({
        menuItemId: item.menuItemId,
        quantity: lineQty,
        priceAtOrder: lineTotal / lineQty,
        nameAtOrder: `${deal.title} · ${item.menuItem.name}`,
        optionsLabel: "",
        instructions: "",
      });
    }
  }

  return { ok: true, lines, subtotal, hadPriceOverride };
}

export async function nextOrderNumber() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const n = last ? parseInt(last.orderNumber.replace(/\D/g, ""), 10) || 1000 : 1000;
    const candidate = `ORD-${n + 1 + attempt}`;
    const exists = await prisma.order.findFirst({
      where: { orderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `ORD-${Date.now().toString().slice(-6)}`;
}
