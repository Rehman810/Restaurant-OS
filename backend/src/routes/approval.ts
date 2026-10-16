import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { verifyApprovalPin } from "../lib/approval-pin";
import { clientIp } from "../lib/client-ip";
import { ORDER_OPS } from "../lib/roles";

export const approvalRouter = Router();

approvalRouter.get("/controls", requireAuth, requireRole(...ORDER_OPS), async (_req, res) => {
  const { getStoreSettings } = await import("../lib/settings-data");
  const settings = await getStoreSettings();
  res.json({
    offlinePosEnabled: settings.offlinePosEnabled !== false,
    maxCashierDiscountPercent: Number(settings.maxCashierDiscountPercent),
    requireApprovalForVoid: settings.requireApprovalForVoid,
    requireApprovalForRefund: settings.requireApprovalForRefund,
    requireApprovalForPriceOverride: settings.requireApprovalForPriceOverride,
    voidReasonOptions: settings.voidReasonOptions,
    discountReasonOptions: settings.discountReasonOptions,
    refundReasonOptions: settings.refundReasonOptions,
  });
});

approvalRouter.post(
  "/verify",
  requireAuth,
  requireRole(...ORDER_OPS),
  async (req, res) => {
    const { approverId, pin } = req.body as { approverId?: string; pin?: string };
    if (!approverId?.trim() || !pin?.trim()) {
      return res.status(400).json({ error: "Approver and PIN are required.", code: "INVALID_REQUEST" });
    }
    const result = await verifyApprovalPin(approverId.trim(), pin.trim(), {
      ip: clientIp(req) ?? undefined,
      requesterId: req.user!.id,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }
    res.json({
      ok: true,
      approverId: result.approver.id,
      approverName: result.approver.name,
      approverRole: result.approver.role,
    });
  }
);

approvalRouter.get("/approvers", requireAuth, requireRole(...ORDER_OPS), async (_req, res) => {
  const rows = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  res.json({ approvers: rows });
});
