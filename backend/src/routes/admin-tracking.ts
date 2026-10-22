import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ORDER_OPS } from "../lib/roles";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { orderAlertThresholds } from "../lib/order-alert-thresholds";
import { getStoreSettings } from "../lib/settings-data";
import { buildTrackingBoard, buildTrackingSummary } from "../lib/admin-orders/board";
import { buildTrackingRidersPanel } from "../lib/admin-orders/riders-panel";
import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const adminTrackingRouter = Router();
adminTrackingRouter.use(requireEntitlement("delivery"));

const BOARD_ROLES = [...ORDER_OPS, Role.RIDER] as Role[];

async function resolveTimezone(scope: Awaited<ReturnType<typeof resolveBranchScope>>) {
  const settings = await getStoreSettings();
  if (!scope.allBranches && scope.branchId) {
    const { prisma } = await import("../lib/prisma");
    const branch = await prisma.branch.findUnique({
      where: { id: scope.branchId },
      select: { timezone: true },
    });
    return branch?.timezone || settings.timezone || "Asia/Karachi";
  }
  return settings.timezone || "Asia/Karachi";
}

async function dispatchSettings() {
  const settings = await getStoreSettings();
  return {
    ...orderAlertThresholds(settings),
    ordersStaleHours: settings.ordersStaleHours ?? 2,
    trackingCompletedWindowHours: settings.trackingCompletedWindowHours ?? 0,
    duplicateOrderWindowMinutes: settings.duplicateOrderWindowMinutes ?? 10,
  };
}

adminTrackingRouter.get("/summary", requireAuth, requireRole(...BOARD_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const timeZone = await resolveTimezone(scope);
  const settings = await dispatchSettings();
  const payload = await buildTrackingSummary(scope, req.user!, timeZone, settings);
  res.json(payload);
});

adminTrackingRouter.get("/board", requireAuth, requireRole(...BOARD_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const timeZone = await resolveTimezone(scope);
  const settings = await dispatchSettings();
  const payload = await buildTrackingBoard(req, scope, req.user!, timeZone, settings);
  res.json(payload);
});

adminTrackingRouter.get("/riders", requireAuth, requireRole(...BOARD_ROLES), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const riders = await buildTrackingRidersPanel(scope, req.user!.role);
  res.json({ riders, serverTime: new Date().toISOString() });
});
