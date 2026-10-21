import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import {
  DEMO_ADMIN_EMAIL,
  isProtectedStaffUser,
  isTestUserRecord,
} from "../test-users";
import { fetchUserHistoryCounts, hasStaffHistory } from "./history";

export type CleanupAction =
  | { kind: "skip"; userId: string; email: string; reason: string }
  | { kind: "delete"; userId: string; email: string }
  | { kind: "deactivate"; userId: string; email: string; historyTotal: number };

export type CleanupPlan = {
  actions: CleanupAction[];
};

export async function planTestStaffCleanup(): Promise<CleanupPlan> {
  const activeAdminIds = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
  });
  const soleActiveAdminId = activeAdminIds.length === 1 ? activeAdminIds[0].id : null;
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ isTest: true }, { email: { endsWith: "@test.local", mode: "insensitive" } }],
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      isTest: true,
    },
  });

  const actions: CleanupAction[] = [];

  for (const user of candidates) {
    if (!isTestUserRecord(user)) {
      actions.push({ kind: "skip", userId: user.id, email: user.email, reason: "Not a test account" });
      continue;
    }
    if (isProtectedStaffUser(user)) {
      actions.push({ kind: "skip", userId: user.id, email: user.email, reason: "Protected demo admin" });
      continue;
    }
    if (user.role === Role.ADMIN && user.isActive && user.id === soleActiveAdminId) {
      actions.push({
        kind: "skip",
        userId: user.id,
        email: user.email,
        reason: "Last active admin account",
      });
      continue;
    }

    const counts = await fetchUserHistoryCounts(user.id);
    if (hasStaffHistory(counts)) {
      actions.push({
        kind: "deactivate",
        userId: user.id,
        email: user.email,
        historyTotal:
          counts.ordersAsCustomer +
          counts.ordersAsRider +
          counts.ordersAsPos +
          counts.ordersAsWaiter +
          counts.cashShifts +
          counts.cashMovements +
          counts.riderCashEntries +
          counts.auditAsActor +
          counts.auditAsEntity,
      });
    } else {
      actions.push({ kind: "delete", userId: user.id, email: user.email });
    }
  }

  return { actions };
}

export function formatCleanupPlan(plan: CleanupPlan): string {
  const deleteN = plan.actions.filter((a) => a.kind === "delete").length;
  const deactivateN = plan.actions.filter((a) => a.kind === "deactivate").length;
  const skipN = plan.actions.filter((a) => a.kind === "skip").length;
  const lines = [
    `Planned actions: delete ${deleteN}, deactivate ${deactivateN}, skip ${skipN}`,
    "",
  ];
  for (const a of plan.actions) {
    if (a.kind === "skip") {
      lines.push(`SKIP  ${a.email} — ${a.reason}`);
    } else if (a.kind === "delete") {
      lines.push(`DELETE ${a.email} (no history)`);
    } else {
      lines.push(`DEACTIVATE ${a.email} (history rows: ${a.historyTotal}), revoke sessions`);
    }
  }
  return lines.join("\n");
}

export async function applyTestStaffCleanup(plan: CleanupPlan): Promise<void> {
  for (const action of plan.actions) {
    if (action.kind === "skip") continue;
    if (action.kind === "deactivate") {
      await prisma.user.update({
        where: { id: action.userId },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      });
      continue;
    }
    await prisma.branchMember.deleteMany({ where: { userId: action.userId } });
    await prisma.user.delete({ where: { id: action.userId } });
  }
}
