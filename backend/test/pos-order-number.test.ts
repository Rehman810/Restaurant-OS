import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { nextPosOrderNumber } from "../src/lib/pos-order-number";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("[POS-OFF-03] order number allocator", () => {
  it("returns unique sequential numbers per branch day under concurrency", async () => {
    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) return;

    const numbers = await prisma.$transaction(async (tx) => {
      const a = await nextPosOrderNumber(tx, branch.id);
      const b = await nextPosOrderNumber(tx, branch.id);
      return [a, b];
    });

    expect(numbers[0]).not.toBe(numbers[1]);
    expect(numbers[0]).toMatch(/^ORD-/);
    expect(numbers[1]).toMatch(/^ORD-/);
    const seqA = Number(numbers[0].split("-").pop());
    const seqB = Number(numbers[1].split("-").pop());
    expect(seqB).toBe(seqA + 1);
  });
});
