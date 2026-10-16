import { branchDayKey } from "./dine-in/branch-time";

type Tx = {
  branch: {
    findUnique: (args: {
      where: { id: string };
      select: { code: true; timezone: true };
    }) => Promise<{ code: string; timezone: string } | null>;
  };
  branchPosOrderDayCounter: {
    upsert: (args: {
      where: { branchId_dayKey: { branchId: string; dayKey: string } };
      create: { branchId: string; dayKey: string; lastSeq: number };
      update: { lastSeq: { increment: number } };
    }) => Promise<{ lastSeq: number }>;
  };
};

/** Gap-free POS order numbers per branch per calendar day (branch timezone). */
export async function nextPosOrderNumber(tx: Tx, branchId: string, at: Date = new Date()) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { code: true, timezone: true },
  });
  const tz = branch?.timezone || "Asia/Karachi";
  const code = (branch?.code || "BR").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase() || "BR";
  const dayKey = branchDayKey(tz, at);

  const row = await tx.branchPosOrderDayCounter.upsert({
    where: { branchId_dayKey: { branchId, dayKey } },
    create: { branchId, dayKey, lastSeq: 1001 },
    update: { lastSeq: { increment: 1 } },
  });

  const seq = row.lastSeq;
  return `ORD-${code}-${dayKey}-${seq}`;
}
