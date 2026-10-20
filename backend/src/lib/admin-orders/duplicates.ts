import { Prisma } from "@prisma/client";

export function normalizeOrderPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function itemMultisetKey(
  items: { menuItemId: string; quantity: number }[]
): string {
  const parts = items
    .map((i) => `${i.menuItemId}:${i.quantity}`)
    .sort();
  return parts.join("|");
}

type OrderDupCandidate = {
  id: string;
  createdAt: Date;
  customerPhone: string;
  items: { menuItemId: string; quantity: number }[];
};

/** Find an earlier order within the window with same phone + line multiset. */
export function findPossibleDuplicateOf(
  order: OrderDupCandidate,
  candidates: OrderDupCandidate[],
  windowMinutes: number
): string | null {
  const phone = normalizeOrderPhone(order.customerPhone);
  if (!phone) return null;
  const multiset = itemMultisetKey(order.items);
  const windowMs = windowMinutes * 60_000;
  const created = order.createdAt.getTime();

  let best: { id: string; createdAt: number } | null = null;
  for (const c of candidates) {
    if (c.id === order.id) continue;
    const cTime = c.createdAt.getTime();
    if (cTime >= created) continue;
    if (created - cTime > windowMs) continue;
    if (normalizeOrderPhone(c.customerPhone) !== phone) continue;
    if (itemMultisetKey(c.items) !== multiset) continue;
    if (!best || cTime > best.createdAt) {
      best = { id: c.id, createdAt: cTime };
    }
  }
  return best?.id ?? null;
}

export function duplicateCandidateWhere(
  branchWhere: Prisma.OrderWhereInput,
  phone: string,
  createdAt: Date,
  windowMinutes: number
): Prisma.OrderWhereInput {
  const normalized = normalizeOrderPhone(phone);
  const from = new Date(createdAt.getTime() - windowMinutes * 60_000);
  return {
    ...branchWhere,
    createdAt: { gte: from, lt: createdAt },
    OR: [
      { customerPhone: { contains: normalized.slice(-10) } },
      { customerPhone: phone },
    ],
  };
}
