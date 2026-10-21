"use client";

import { Briefcase, ChefHat, Shield, Users } from "lucide-react";
import { AdminKpiCard, AdminKpiGrid } from "@/components/admin/ui";
import type { StaffTileCounts, StaffTileFilter } from "@/modules/staff/types";

export function StaffKpiStrip({
  counts,
  activeTile,
  onTile,
}: {
  counts: StaffTileCounts | undefined;
  activeTile: StaffTileFilter;
  onTile: (tile: StaffTileFilter) => void;
}) {
  const total = counts?.total ?? 0;
  const inactive = counts?.inactive ?? 0;
  const active = Math.max(0, total - inactive);
  const ops =
    (counts?.chefs ?? 0) + (counts?.cashiers ?? 0) + (counts?.riders ?? 0) + (counts?.waiters ?? 0);

  return (
    <AdminKpiGrid>
      <AdminKpiCard
        label="Team members"
        value={total}
        hint={`${active} active · ${inactive} inactive`}
        icon={Users}
        accent="sky"
        onClick={() => onTile(null)}
      />
      <AdminKpiCard
        label="Admins"
        value={counts?.admins ?? "—"}
        hint="Full system access"
        icon={Shield}
        accent="violet"
        onClick={() => onTile(activeTile === "admins" ? null : "admins")}
      />
      <AdminKpiCard
        label="Managers"
        value={counts?.managers ?? "—"}
        hint="Branch operations"
        icon={Briefcase}
        accent="brand"
        onClick={() => onTile(activeTile === "managers" ? null : "managers")}
      />
      <AdminKpiCard
        label="Front of house"
        value={ops}
        hint="Chefs, cashiers, riders, waiters"
        icon={ChefHat}
        accent="emerald"
      />
    </AdminKpiGrid>
  );
}
