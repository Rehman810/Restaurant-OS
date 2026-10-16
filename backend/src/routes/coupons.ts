import { Router } from "express";
import { CouponDiscountType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import {
  computeCouponDiscount,
  normalizeCouponCode,
  validateCouponWindow,
} from "../lib/coupon";

export const couponsPublicRouter = Router();

couponsPublicRouter.post("/validate", async (req, res) => {
  const code = normalizeCouponCode(String(req.body.code || ""));
  const subtotal = Number(req.body.subtotal);
  const branchId = typeof req.body.branchId === "string" ? req.body.branchId.trim() : "";
  if (!code) return res.status(400).json({ error: "Enter a promo code." });
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return res.status(400).json({ error: "Invalid subtotal." });
  }

  const coupon = await prisma.coupon.findFirst({
    where: { code, isActive: true },
  });
  if (!coupon) return res.status(404).json({ error: "Promo code not found." });
  if (coupon.branchId && branchId && coupon.branchId !== branchId) {
    return res.status(400).json({ error: "This code is not valid for your branch." });
  }
  const windowErr = validateCouponWindow(coupon);
  if (windowErr) return res.status(400).json({ error: windowErr });

  const result = computeCouponDiscount(coupon, subtotal);
  if (!result.ok) return res.status(400).json({ error: result.error });

  res.json({
    code: coupon.code,
    type: coupon.type,
    discount: result.discount,
    couponId: result.couponId,
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
  const {
    code,
    type,
    value,
    minSubtotal,
    maxDiscount,
    usageLimit,
    startsAt,
    endsAt,
    isActive,
    branchId: bodyBranchId,
  } = req.body as {
    code?: string;
    type?: CouponDiscountType;
    value?: number;
    minSubtotal?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
    branchId?: string | null;
  };
  const normalized = normalizeCouponCode(code || "");
  if (!normalized) return res.status(400).json({ error: "Code is required." });
  if (!type || !Object.values(CouponDiscountType).includes(type)) {
    return res.status(400).json({ error: "Invalid discount type." });
  }
  const val = Number(value);
  if (!Number.isFinite(val) || val <= 0) {
    return res.status(400).json({ error: "Value must be greater than zero." });
  }
  let branchId: string | null = null;
  if (!scope.allBranches) branchId = scope.branchId!;
  else if (bodyBranchId) branchId = String(bodyBranchId);

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: normalized,
        type,
        value: val,
        minSubtotal: Number(minSubtotal) || 0,
        maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
        usageLimit: usageLimit != null ? Number(usageLimit) : null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        isActive: isActive !== false,
        branchId,
      },
    });
    res.status(201).json(coupon);
  } catch {
    res.status(400).json({ error: "Could not create coupon. Code may already exist." });
  }
});

couponsAdminRouter.patch("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Coupon not found." });
  const body = req.body as Record<string, unknown>;
  const coupon = await prisma.coupon.update({
    where: { id: existing.id },
    data: {
      ...(body.isActive != null ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.usageLimit !== undefined
        ? { usageLimit: body.usageLimit === null || body.usageLimit === "" ? null : Number(body.usageLimit) }
        : {}),
      ...(body.endsAt !== undefined
        ? { endsAt: body.endsAt ? new Date(String(body.endsAt)) : null }
        : {}),
    },
  });
  res.json(coupon);
});
