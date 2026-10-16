import { branchDayKey } from "../dine-in/branch-time";

type Tx = {
  branch: { findUnique: (args: {
    where: { id: string };
    select: { code: true; timezone: true };
  }) => Promise<{ code: string; timezone: string } | null> };
  branchTaxInvoiceCounter: {
    upsert: (args: {
      where: { branchId_fiscalYear: { branchId: string; fiscalYear: number } };
      create: { branchId: string; fiscalYear: number; lastSeq: number };
      update: { lastSeq: { increment: number } };
    }) => Promise<{ lastSeq: number }>;
  };
};

export async function nextTaxInvoiceNumber(
  tx: Tx,
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
    ? Number(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(at)
      )
    : 0;
  const dayKey = fiscalYearEnabled ? String(year) : branchDayKey(tz, at);

  const row = await tx.branchTaxInvoiceCounter.upsert({
    where: { branchId_fiscalYear: { branchId, fiscalYear: year } },
    create: { branchId, fiscalYear: year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });

  const seq = row.lastSeq;
  return fiscalYearEnabled ? `TAX-${code}-${year}-${seq}` : `TAX-${code}-${dayKey}-${seq}`;
}
