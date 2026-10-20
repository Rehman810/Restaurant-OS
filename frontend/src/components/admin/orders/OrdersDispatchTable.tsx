"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui";
import type { AdminOrderRow } from "@/lib/admin-orders/types";
import { Rider } from "@/lib/admin-types";
import type { Role } from "@/lib/types";
import { OrdersDispatchListHeader, OrdersDispatchRow } from "./OrdersDispatchRow";

export function OrdersDispatchTable({
  rows,
  riders,
  timeZone,
  serverTime,
  role,
  flashIds,
  onAction,
  onCancel,
  onAssignRider,
  onSelect,
  onOpenDuplicate,
  onMenuOpenChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  dimmed,
}: {
  rows: AdminOrderRow[];
  riders: Rider[];
  timeZone: string;
  serverTime: string;
  role: Role | undefined;
  flashIds: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  dimmed?: boolean;
  onAction: (row: AdminOrderRow, action: AdminOrderRow["nextActions"][number]) => void;
  onCancel: (row: AdminOrderRow) => void;
  onAssignRider: (row: AdminOrderRow, riderId: string) => void;
  onSelect: (row: AdminOrderRow) => void;
  onOpenDuplicate?: (id: string) => void;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const anchorMs = new Date(serverTime).getTime();
  const showPayment = role !== "CHEF";
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  if (!rows.length) {
    return (
      <AdminEmptyState
        icon={ClipboardList}
        title="No orders to show"
        description="Adjust filters or wait for new orders from the storefront or POS."
      />
    );
  }

  const allSelected =
    selectedIds && rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <div className={`space-y-2 transition-opacity ${dimmed ? "opacity-60" : ""}`}>
      <OrdersDispatchListHeader
        showPayment={showPayment}
        allSelected={allSelected}
        onToggleSelectAll={onToggleSelect ? onToggleSelectAll : undefined}
      />
      <div className="space-y-2.5">
        {rows.map((row) => {
          const primary = row.nextActions.find((a) => a.primary);
          return (
            <OrdersDispatchRow
              key={row.id}
              row={row}
              riders={riders}
              timeZone={timeZone}
              anchorMs={anchorMs}
              role={role}
              showPayment={showPayment}
              flash={flashIds.has(row.id)}
              selected={selectedIds?.has(row.id)}
              primary={primary}
              openMenu={openMenu === row.id}
              onToggleMenu={() => {
                const next = openMenu === row.id ? null : row.id;
                setOpenMenu(next);
                onMenuOpenChange?.(Boolean(next));
              }}
              onSelect={() => onSelect(row)}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(row.id) : undefined}
              onAction={(a) => onAction(row, a)}
              onCancel={() => onCancel(row)}
              onAssignRider={(id) => onAssignRider(row, id)}
              onOpenDuplicate={onOpenDuplicate}
            />
          );
        })}
      </div>
    </div>
  );
}
