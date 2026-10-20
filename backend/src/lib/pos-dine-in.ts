import { TableSessionStatus, TableStatus } from "@prisma/client";
import { prisma } from "./prisma";

export async function resolvePosDineIn(
  branchId: string,
  input: {
    tableNumber?: string;
    tableSessionId?: string;
    diningTableId?: string;
    tableId?: string;
    waiterId?: string;
  }
) {
  const tableId = input.diningTableId || input.tableId || null;
  let dineSession: {
    id: string;
    tableId: string;
    table: { label: string; branchId: string };
    waiterId: string | null;
  } | null = null;
  let resolvedTableNumber: string | null = input.tableNumber?.trim() || null;
  let resolvedDiningTableId: string | null = tableId;
  let resolvedSessionId: string | null = input.tableSessionId || null;
  let resolvedWaiterId: string | null = input.waiterId || null;

  if (input.tableSessionId) {
    dineSession = await prisma.tableSession.findFirst({
      where: { id: input.tableSessionId, status: TableSessionStatus.OPEN, branchId },
      include: { table: true },
    });
    if (!dineSession) {
      return { ok: false as const, status: 400, error: "Invalid or closed table session." };
    }
    if (tableId && dineSession.tableId !== tableId) {
      return { ok: false as const, status: 400, error: "Table does not match the open session." };
    }
    resolvedTableNumber = dineSession.table.label;
    resolvedDiningTableId = dineSession.tableId;
    resolvedSessionId = dineSession.id;
    if (!resolvedWaiterId && dineSession.waiterId) resolvedWaiterId = dineSession.waiterId;
  } else if (tableId) {
    const table = await prisma.diningTable.findUnique({ where: { id: tableId } });
    if (!table || table.branchId !== branchId) {
      return { ok: false as const, status: 400, error: "Table not found for this branch." };
    }
    const openSession = await prisma.tableSession.findFirst({
      where: { tableId, branchId, status: TableSessionStatus.OPEN },
      include: { table: true },
    });
    if (openSession) {
      dineSession = openSession;
      resolvedSessionId = openSession.id;
      resolvedTableNumber = openSession.table.label;
      if (!resolvedWaiterId && openSession.waiterId) resolvedWaiterId = openSession.waiterId;
    } else if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
      return {
        ok: false as const,
        status: 400,
        error: "Table is not available. Open a table session first.",
      };
    } else {
      resolvedTableNumber = table.label;
    }
  }

  if (!resolvedDiningTableId && !resolvedSessionId) {
    return { ok: false as const, status: 400, error: "Select a table for dine-in orders." };
  }

  return {
    ok: true as const,
    resolvedTableNumber,
    resolvedDiningTableId,
    resolvedSessionId,
    resolvedWaiterId,
    dineSession,
  };
}
