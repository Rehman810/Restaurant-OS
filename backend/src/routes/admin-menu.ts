import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import {
  branchScopeError,
  getDefaultBranchId,
  resolveBranchScope,
  userCanAccessBranch,
} from "../lib/branch-scope";
import { prisma } from "../lib/prisma";
import { getStoreSettings } from "../lib/settings-data";
import { listAdminDishes } from "../lib/admin-menu/dish-list";
import { listAdminDeals } from "../lib/admin-menu/deal-list";
import { listAdminCategories } from "../lib/admin-menu/category-list";
import {
  archiveCategory,
  deleteCategory,
  reorderCategories,
  setCategoryVisibility,
  updateCategoryFields,
  parseCategoryScheduleBody,
} from "../lib/admin-menu/category-mutations";
import {
  archiveMenuItem,
  deleteMenuItemIfAllowed,
  duplicateMenuItem,
  patchDishAvailability,
  reorderDishesInCategory,
  setDealVisibility,
  setDishVisibility,
} from "../lib/admin-menu/mutations";
import { runMenuBulk, type BulkAction } from "../lib/admin-menu/bulk";

import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const adminMenuRouter = Router();
adminMenuRouter.use(requireEntitlement("catalog"));

const MENU_READ = [...ADMIN_LIKE, Role.CHEF, Role.CASHIER] as Role[];
const AVAILABILITY_ROLES = [...ADMIN_LIKE, Role.CHEF, Role.CASHIER] as Role[];

async function branchTimezone(branchId: string) {
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  return branch?.timezone || settings.timezone || "Asia/Karachi";
}

function parseStatusQuery(req: { query: Record<string, unknown> }) {
  const raw = req.query["status[]"] ?? req.query.status;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw) return raw.split(",");
  return [];
}

adminMenuRouter.get("/dishes", requireAuth, requireRole(...MENU_READ), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.branchId ?? await getDefaultBranchId();
  const timezone = await branchTimezone(branchId);
  const includeCost = req.user!.role === Role.ADMIN || req.user!.role === Role.MANAGER;

  const payload = await listAdminDishes({
    branchId,
    timezone,
    q: String(req.query.q || ""),
    categoryId: String(req.query.categoryId || "") || undefined,
    status: parseStatusQuery(req),
    tag: String(req.query.tag || "") || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
    includeCost,
  });

  res.json(payload);
});

adminMenuRouter.get("/categories", requireAuth, requireRole(...MENU_READ), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.branchId ?? await getDefaultBranchId();
  const timezone = await branchTimezone(branchId);
  const payload = await listAdminCategories({
    q: String(req.query.q || ""),
    status: parseStatusQuery(req),
    includeArchived: req.query.includeArchived === "true",
    timezone,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
  });
  res.json(payload);
});

adminMenuRouter.patch("/categories/:id/visibility", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const visible = req.body.visible !== false;
  const result = await setCategoryVisibility(req, req.params.id, visible);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, visible });
});

adminMenuRouter.put("/categories/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const schedule = parseCategoryScheduleBody(req.body);
  const result = await updateCategoryFields(req, req.params.id, {
    name: req.body.name !== undefined ? String(req.body.name) : undefined,
    tagline: req.body.tagline !== undefined ? String(req.body.tagline) : undefined,
    imageUrl: req.body.imageUrl !== undefined ? String(req.body.imageUrl) : undefined,
    isVisible: req.body.isVisible !== undefined ? req.body.isVisible !== false : undefined,
    scheduleDays: schedule.scheduleDays,
    scheduleStartMinutes: schedule.scheduleStartMinutes,
    scheduleEndMinutes: schedule.scheduleEndMinutes,
  });
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json(result.category);
});

adminMenuRouter.post("/categories/:id/archive", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const archive = req.body.archive !== false;
  const result = await archiveCategory(req, req.params.id, archive);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminMenuRouter.put("/categories/reorder", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds.map(String) : [];
  if (!orderedIds.length) return res.status(400).json({ error: "orderedIds required." });
  const result = await reorderCategories(req, orderedIds);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminMenuRouter.delete("/categories/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const moveToCategoryId = req.body?.moveToCategoryId ? String(req.body.moveToCategoryId) : undefined;
  const result = await deleteCategory(req, req.params.id, moveToCategoryId);
  if (result.status !== 200) {
    return res.status(result.status).json({
      error: result.error,
      ...(result.requiresMoveTo ? { requiresMoveTo: true, dishCount: result.dishCount } : {}),
    });
  }
  res.json({ ok: true });
});

adminMenuRouter.get("/deals", requireAuth, requireRole(...MENU_READ), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.branchId ?? await getDefaultBranchId();
  const timezone = await branchTimezone(branchId);
  const payload = await listAdminDeals({
    branchId,
    timezone,
    q: String(req.query.q || ""),
    group: String(req.query.group || "") || undefined,
    status: parseStatusQuery(req),
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 10,
  });
  res.json(payload);
});

adminMenuRouter.patch("/deals/:id/visibility", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const visible = req.body.visible !== false;
  const result = await setDealVisibility(req, req.params.id, visible);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, visible });
});

adminMenuRouter.patch("/:type/:id/availability", requireAuth, requireRole(...AVAILABILITY_ROLES), async (req, res) => {
  const type = req.params.type === "deal" ? "deal" : "dish";
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.branchId ?? await getDefaultBranchId();
  if (!(await userCanAccessBranch(req.user!, branchId))) {
    return res.status(403).json({ error: "Branch not allowed." });
  }

  const scopeMode = req.body.scope === "allBranches" ? "allBranches" : "currentBranch";
  if (scopeMode === "allBranches" && !ADMIN_LIKE.includes(req.user!.role)) {
    return res.status(403).json({ error: "Only managers can change all branches." });
  }

  const timezone = await branchTimezone(branchId);
  const result = await patchDishAvailability(
    req,
    type,
    req.params.id,
    branchId,
    timezone,
    { state: req.body.state, until: req.body.until },
    scopeMode
  );
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminMenuRouter.patch("/dishes/:id/visibility", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const visible = req.body.visible !== false;
  const result = await setDishVisibility(req, req.params.id, visible);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, isVisible: visible });
});

adminMenuRouter.post("/dishes/:id/duplicate", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const result = await duplicateMenuItem(req, req.params.id);
  if (result.status !== 201) return res.status(result.status).json({ error: result.error });
  res.status(201).json({ id: result.id });
});

adminMenuRouter.post("/dishes/:id/archive", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const archive = req.body.archive !== false;
  const result = await archiveMenuItem(req, req.params.id, archive);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminMenuRouter.delete("/dishes/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const result = await deleteMenuItemIfAllowed(req, req.params.id);
  if (result.status !== 200) return res.status(result.status).json(result);
  res.json({ ok: true });
});

adminMenuRouter.put("/dishes/reorder", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { category, orderedIds } = req.body as { category?: string; orderedIds?: string[] };
  if (!category || !Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "category and orderedIds required." });
  }
  const result = await reorderDishesInCategory(category, orderedIds, req);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

adminMenuRouter.post("/bulk", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchId = scope.branchId ?? await getDefaultBranchId();
  const timezone = await branchTimezone(branchId);
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  const action = req.body as BulkAction & { action: string };
  if (!action.action) return res.status(400).json({ error: "action required" });

  const result = await runMenuBulk(req, ids, action as BulkAction, branchId, timezone);
  if (result.status !== 200) return res.status(result.status).json({ error: result.error });
  res.json(result);
});
