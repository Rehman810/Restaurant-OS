import { branchDayKey } from "../dine-in/branch-time";
import { allocateCounter, type CounterTx } from "../counters";

type InvoiceTx = CounterTx & {
  branch: { findUnique: Function };
  branchTaxInvoiceCounter: { upsert: Function };
};

export async function nextTaxInvoiceNumber(
  tx: InvoiceTx,
  branchId: string,
  fiscalYearEnabled: boolean,
  at: Date = new Date()
) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { code: true, timezone: true },
  });
  const code = (branch?.code || "BR").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase() || "BR";
  const tz = branch?.timezone || "Asia/Karachi";
  const year = fiscalYearEnabled
    ? Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(at))
    : 0;
  const dayKey = fiscalYearEnabled ? String(year) : branchDayKey(tz, at);
  const seq = await allocateCounter(tx, {
    name: "invoice",
    branchId,
    periodKey: String(year),
    floor: 0,
  });
  await tx.branchTaxInvoiceCounter.upsert({
    where: { branchId_fiscalYear: { branchId, fiscalYear: year } },
    create: { branchId, fiscalYear: year, lastSeq: seq },
    update: { lastSeq: seq },
  });
  return fiscalYearEnabled ? `TAX-${code}-${year}-${seq}` : `TAX-${code}-${dayKey}-${seq}`;
}
