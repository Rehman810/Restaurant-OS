"use client";

import { OrderBoard } from "@/components/admin/order-board";
import { columnsFromRows } from "@/lib/admin-orders/columns-from-rows";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import type { Role } from "@/lib/types";

/** @deprecated Use OrderBoard directly. Kept for gradual migration. */
export function OrdersStatusBoard(props: {
  rows: AdminOrderRow[];
  timeZone: string;
  serverTime: string;
  role?: Role;
  flashIds: Set<string>;
  onOpen: (row: AdminOrderRow) => void;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
  onAssignRider?: (row: AdminOrderRow) => void;
}) {
  const columns = columnsFromRows(props.rows);
  const cancelled = props.rows.filter((r) => r.status === "CANCELLED");
  return (
    <OrderBoard
      columns={columns}
      cancelledToday={cancelled}
      timeZone={props.timeZone}
      serverTime={props.serverTime}
      role={props.role}
      flashIds={props.flashIds}
      onOpen={props.onOpen}
      onAction={props.onAction}
      onAssignRider={props.onAssignRider}
    />
  );
}
