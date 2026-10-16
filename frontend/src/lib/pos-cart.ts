"use client";

import { create } from "zustand";
import { MenuItem } from "./types";
import { cartLineKey } from "./cart";

export type PosLine = {
  id: string;
  menuItemId?: string;
  kind?: "item" | "deal";
  name: string;
  price: number;
  catalogPrice?: number;
  quantity: number;
  dealId?: string;
  optionIds?: string[];
  addonIds?: string[];
  optionsLabel?: string;
  instructions?: string;
};

type PosCartState = {
  lines: PosLine[];
  addItem: (opts: {
    item: MenuItem;
    price: number;
    quantity?: number;
    optionIds?: string[];
    addonIds?: string[];
    optionsLabel?: string;
    instructions?: string;
  }) => void;
  addDeal: (deal: { id: string; title: string; dealPrice: string | number }) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  setLinePrice: (id: string, price: number) => void;
  clear: () => void;
};

export const usePosCart = create<PosCartState>((set, get) => ({
  lines: [],
  addItem: ({ item, price, quantity = 1, optionIds, addonIds, optionsLabel, instructions }) => {
    const note = (instructions ?? "").trim();
    const id = cartLineKey(item.id, optionIds, addonIds, note);
    const lines = [...get().lines];
    const idx = lines.findIndex((l) => l.id === id);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + quantity };
    } else {
      lines.push({
        id,
        menuItemId: item.id,
        kind: "item",
        name: item.name,
        price,
        catalogPrice: price,
        quantity,
        optionIds,
        addonIds,
        optionsLabel,
        instructions: note || undefined,
      });
    }
    set({ lines });
  },
  addDeal: (deal) => {
    const id = `deal:${deal.id}`;
    const lines = [...get().lines];
    const idx = lines.findIndex((l) => l.id === id);
    if (idx >= 0) {
      lines[idx] = { ...lines[idx], quantity: lines[idx].quantity + 1 };
    } else {
      lines.push({
        id,
        kind: "deal",
        dealId: deal.id,
        name: deal.title,
        price: Number(deal.dealPrice),
        catalogPrice: Number(deal.dealPrice),
        quantity: 1,
      });
    }
    set({ lines });
  },
  setQty: (id, qty) => {
    if (qty < 1) {
      set({ lines: get().lines.filter((l) => l.id !== id) });
      return;
    }
    set({ lines: get().lines.map((l) => (l.id === id ? { ...l, quantity: qty } : l)) });
  },
  remove: (id) => set({ lines: get().lines.filter((l) => l.id !== id) }),
  setLinePrice: (id, price) => {
    const n = Number(price);
    if (!Number.isFinite(n) || n < 0) return;
    set({
      lines: get().lines.map((l) => (l.id === id ? { ...l, price: n } : l)),
    });
  },
  clear: () => set({ lines: [] }),
}));

export function posCartTotal(lines: PosLine[]) {
  return lines.reduce((s, l) => s + l.price * l.quantity, 0);
}

export function buildPosOrderPayload(lines: PosLine[]) {
  const items = lines
    .filter((l) => !l.kind || l.kind === "item")
    .filter((l) => l.menuItemId)
    .map((l) => ({
      menuItemId: l.menuItemId!,
      quantity: l.quantity,
      optionIds: l.optionIds,
      addonIds: l.addonIds,
      instructions: l.instructions,
      ...(l.catalogPrice != null && Math.abs(l.price - l.catalogPrice) > 0.009
        ? { unitPriceOverride: l.price }
        : {}),
    }));
  const deals = lines
    .filter((l) => l.kind === "deal" && l.dealId)
    .map((l) => ({ dealId: l.dealId!, quantity: l.quantity }));
  return { items, deals };
}
