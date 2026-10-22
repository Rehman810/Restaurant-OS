import { branchDayKey } from "./dine-in/branch-time";
import { allocateCounter, type CounterTx } from "./counters";

type PosTx = CounterTx & {
  branch: { findUnique: Function };
  branchPosOrderDayCounter: { upsert: Function };
};

/** Gap-free POS order numbers per branch per calendar day (branch timezone). */
export async function nextPosOrderNumber(tx: PosTx, branchId: string, at: Date = new Date()) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { code: true, timezone: true },
  });
  const tz = branch?.timezone || "Asia/Karachi";
  const code = (branch?.code || "BR").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase() || "BR";
  const dayKey = branchDayKey(tz, at);
  const seq = await allocateCounter(tx, { name: "pos_order", branchId, periodKey: dayKey, floor: 1000 });
  await tx.branchPosOrderDayCounter.upsert({
    where: { branchId_dayKey: { branchId, dayKey } },
    create: { branchId, dayKey, lastSeq: seq },
    update: { lastSeq: seq },
  });
  return `ORD-${code}-${dayKey}-${seq}`;
}
