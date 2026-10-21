import type { Request, Response } from "express";
import { CashShiftStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { storeDateKey } from "../lib/dashboard/dates";

function storeTimeParts(tz: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

export async function handleDailySummaryBlockers(req: Request, res: Response) {
  try {
    const scope = await resolveBranchScope(req);
    const settings = await getStoreSettings();
    const tz = settings.timezone || "Asia/Karachi";
    const now = new Date();
    const dateKey = storeDateKey(tz, now);
    const { hour, minute } = storeTimeParts(tz, now);
    const sendHour = settings.dailyCloseoutEmailSendHour ?? 23;
    const sendMinute = settings.dailyCloseoutEmailSendMinute ?? 30;
    const afterCutoff = hour > sendHour || (hour === sendHour && minute >= sendMinute);

    const where: { status: CashShiftStatus; branchId?: string } = {
      status: CashShiftStatus.OPEN,
    };
    if (!scope.allBranches && scope.branchId) where.branchId = scope.branchId;

    const openShifts = await prisma.cashShift.count({ where });

    res.json({
      dateKey,
      timezone: tz,
      afterCutoff,
      openShifts,
      sendAt: { hour: sendHour, minute: sendMinute },
    });
  } catch (err) {
    return branchScopeError(res, err);
  }
}
