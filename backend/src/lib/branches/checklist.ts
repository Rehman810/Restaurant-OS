import { prisma } from "../prisma";

export type BranchSetupChecklist = {
  staff: boolean;
  openingStock: boolean;
  tables: boolean;
  printers: boolean;
  testOrder: boolean;
  completed: number;
  total: number;
};

export async function deriveSetupChecklist(branchId: string): Promise<BranchSetupChecklist> {
  const [staff, stockRows, tables, printers, orders] = await Promise.all([
    prisma.branchMember.count({ where: { branchId } }),
    prisma.branchStock.count({ where: { branchId, quantity: { gt: 0 } } }),
    prisma.diningTable.count({ where: { branchId } }),
    prisma.printStation.count({ where: { branchId } }),
    prisma.order.count({ where: { branchId } }),
  ]);

  const items = {
    staff: staff > 0,
    openingStock: stockRows > 0,
    tables: tables > 0,
    printers: printers > 0,
    testOrder: orders > 0,
  };
  const done = Object.values(items).filter(Boolean).length;
  return { ...items, completed: done, total: 5 };
}
