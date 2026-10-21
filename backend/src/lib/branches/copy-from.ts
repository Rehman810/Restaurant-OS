import { prisma } from "../prisma";

export type CopyFromOptions = {
  menuAvailability?: boolean;
  printStations?: boolean;
  tables?: boolean;
  deliveryAreas?: boolean;
  openingHours?: boolean;
};

export type CopyFromSummary = {
  menuAvailability: number;
  printStations: number;
  tableFloors: number;
  tables: number;
  deliveryAreas: number;
  openingHours: boolean;
  skipped: string[];
};

export async function copyBranchSetup(
  tx: typeof prisma,
  sourceBranchId: string,
  targetBranchId: string,
  options: CopyFromOptions
): Promise<CopyFromSummary> {
  const summary: CopyFromSummary = {
    menuAvailability: 0,
    printStations: 0,
    tableFloors: 0,
    tables: 0,
    deliveryAreas: 0,
    openingHours: false,
    skipped: [],
  };

  if (sourceBranchId === targetBranchId) {
    throw Object.assign(new Error("Source and target branch must be different."), { status: 400 });
  }

  const [source, target] = await Promise.all([
    tx.branch.findUnique({ where: { id: sourceBranchId }, select: { id: true, isActive: true } }),
    tx.branch.findUnique({ where: { id: targetBranchId }, select: { id: true } }),
  ]);
  if (!source?.isActive || !target) {
    throw Object.assign(new Error("Branches not found."), { status: 404 });
  }

  if (options.menuAvailability) {
    const rows = await tx.menuItemBranchAvailability.findMany({ where: { branchId: sourceBranchId } });
    for (const row of rows) {
      await tx.menuItemBranchAvailability.upsert({
        where: { menuItemId_branchId: { menuItemId: row.menuItemId, branchId: targetBranchId } },
        create: {
          menuItemId: row.menuItemId,
          branchId: targetBranchId,
          soldOut: row.soldOut,
          untilKind: row.untilKind,
          untilAt: row.untilAt,
          reason: row.reason,
          setById: row.setById,
        },
        update: {
          soldOut: row.soldOut,
          untilKind: row.untilKind,
          untilAt: row.untilAt,
          reason: row.reason,
        },
      });
      summary.menuAvailability += 1;
    }
    const deals = await tx.dealBranchAvailability.findMany({ where: { branchId: sourceBranchId } });
    for (const row of deals) {
      await tx.dealBranchAvailability.upsert({
        where: { dealId_branchId: { dealId: row.dealId, branchId: targetBranchId } },
        create: {
          dealId: row.dealId,
          branchId: targetBranchId,
          soldOut: row.soldOut,
          untilKind: row.untilKind,
          untilAt: row.untilAt,
          reason: row.reason,
        },
        update: {
          soldOut: row.soldOut,
          untilKind: row.untilKind,
          untilAt: row.untilAt,
          reason: row.reason,
        },
      });
    }
  }

  if (options.printStations) {
    const stations = await tx.printStation.findMany({
      where: { branchId: sourceBranchId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    for (const s of stations) {
      await tx.printStation.upsert({
        where: { branchId_code: { branchId: targetBranchId, code: s.code } },
        create: {
          branchId: targetBranchId,
          name: s.name,
          code: s.code,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
          isDefault: s.isDefault,
        },
        update: {
          name: s.name,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
        },
      });
      summary.printStations += 1;
    }
    summary.skipped.push(
      "Menu item → station links are global in this schema; only print stations were copied."
    );
  }

  if (options.tables) {
    const floors = await tx.diningFloor.findMany({
      where: { branchId: sourceBranchId },
      include: { tables: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const floor of floors) {
      const targetFloor = await tx.diningFloor.upsert({
        where: { branchId_name: { branchId: targetBranchId, name: floor.name } },
        create: { branchId: targetBranchId, name: floor.name, sortOrder: floor.sortOrder },
        update: { sortOrder: floor.sortOrder },
      });
      summary.tableFloors += 1;
      for (const table of floor.tables) {
        await tx.diningTable.upsert({
          where: { branchId_label: { branchId: targetBranchId, label: table.label } },
          create: {
            branchId: targetBranchId,
            floorId: targetFloor.id,
            label: table.label,
            capacity: table.capacity,
            seatType: table.seatType,
            zone: table.zone,
            sortOrder: table.sortOrder,
            status: "AVAILABLE",
          },
          update: {
            floorId: targetFloor.id,
            capacity: table.capacity,
            seatType: table.seatType,
            zone: table.zone,
            sortOrder: table.sortOrder,
          },
        });
        summary.tables += 1;
      }
    }
  }

  if (options.deliveryAreas) {
    summary.skipped.push("Delivery areas are store-wide (no branchId); nothing copied.");
  }

  if (options.openingHours) {
    summary.skipped.push("Opening hours live on store settings; not per branch.");
  }

  return summary;
}

export async function runCopyBranchSetup(
  sourceBranchId: string,
  targetBranchId: string,
  options: CopyFromOptions
) {
  return prisma.$transaction((tx) =>
    copyBranchSetup(tx as typeof prisma, sourceBranchId, targetBranchId, options)
  );
}
