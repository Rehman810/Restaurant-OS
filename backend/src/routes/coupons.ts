import { Router } from "express";
import { FulfillmentType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { couponInBranchScope } from "../lib/coupon-branch-scope";
import {
  couponCustomerStats,
  evaluateCoupon,
  normalizeCouponCode,
  type CouponChannel,
} from "../lib/coupon";
import { couponWriteData } from "../lib/coupon-payload";

export const couponsPublicRouter = Router();

couponsPublicRouter.post("/validate", optionalAuth, async (req, res) => {
  const code = normalizeCouponCode(String(req.body.code || ""));
  const subtotal = Number(req.body.subtotal);
  const branchId = typeof req.body.branchId === "string" ? req.body.branchId.trim() : "";
  const channel = (String(req.body.channel || "online").toLowerCase() || "online") as CouponChannel;
  const fulfillment = typeof req.body.fulfillmentType === "string" ? req.body.fulfillmentType : "";
  if (!code) return res.status(400).json({ error: "Enter a promo code." });
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: "Invalid subtotal." });
  }

  const coupon = await prisma.coupon.findFirst({
    where: { code, isActive: true },
  });
  if (!coupon) return res.status(404).json({ error: "Promo code not found." });

  const customerId = req.user?.role === "CUSTOMER" ? req.user.id : undefined;
  const stats = await couponCustomerStats(customerId, coupon.id);
  const result = evaluateCoupon(coupon, {
    subtotal,
    branchId,
    channel: ["online", "pos", "dine_in"].includes(channel) ? channel : "online",
    fulfillment: fulfillment as FulfillmentType,
    customerId,
    ...stats,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });

  res.json({
    code: coupon.code,
    type: coupon.type,
    discount: result.discount,
    couponId: result.couponId,
    minSubtotal: Number(coupon.minSubtotal),
  });
});

export const couponsAdminRouter = Router();

couponsAdminRouter.get("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const where =
    scope.allBranches
      ? {}
      : { OR: [{ branchId: scope.branchId }, { branchId: null }] };
  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({ coupons });
});

couponsAdminRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const parsed = couponWriteData(req.body as Record<string, unknown>, "create");
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  let branchId: string | null = null;
  if (!scope.allBranches) branchId = scope.branchId!;
  else if ((req.body as { branchId?: string }).branchId) branchId = String((req.body as { branchId: string }).branchId);

  try {
    const coupon = await prisma.coupon.create({
      data: { ...(parsed.data as Prisma.CouponUncheckedCreateInput), branchId },
    });
    res.status(201).json(coupon);
  } catch {
    res.status(400).json({ error: "Could not create coupon. Code may already exist." });
  }
});

couponsAdminRouter.patch("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Coupon not found." });
  if (!couponInBranchScope(scope, existing)) {
    return res.status(403).json({ error: "You do not have access to this voucher." });
  }
  const parsed = couponWriteData(req.body as Record<string, unknown>, "update");
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const coupon = await prisma.coupon.update({
      where: { id: existing.id },
      data: parsed.data as Prisma.CouponUncheckedUpdateInput,
    });
    res.json(coupon);
  } catch {
    res.status(400).json({ error: "Could not update coupon. Code may already exist." });
  }
});
