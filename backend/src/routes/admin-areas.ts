import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { getStoreSettings } from "../lib/settings-data";
import { listAdminAreas } from "../lib/delivery/list-admin";
import {
  archiveDeliveryArea,
  bulkDeliveryAreas,
  createDeliveryArea,
  deleteDeliveryAreaIfAllowed,
  reorderDeliveryAreas,
  updateDeliveryArea,
} from "../lib/delivery/mutations";
import { prisma } from "../lib/prisma";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { loadActivePauses, resolvePauseUntil } from "../lib/delivery/pause";
import { invalidateDeliveryAreas } from "../lib/delivery/mutations";
import { serializeAdminAreaRow } from "../lib/delivery/serialize";
import { getRestaurantId } from "../lib/restaurant-context";
import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const adminAreasRouter = Router();
adminAreasRouter.use(requireEntitlement("delivery"));

const EDIT_ROLES = ADMIN_LIKE;

adminAreasRouter.get("/", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const q = String(req.query.q || "");
  const status = String(req.query.status || "all") as
    | "delivering"
    | "paused"
    | "archived"
    | "all";
  const sort = String(req.query.sort || "position") as "position" | "name" | "charge" | "orders";
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 50;
  const data = await listAdminAreas(getRestaurantId(), {
    q,
    status,
    sort,
    page,
    pageSize,
  });
  res.json(data);
});

adminAreasRouter.post("/", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const settings = await getStoreSettings();
  const result = await createDeliveryArea(req.body, settings, req.user!, req);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(result.status).json(serializeAdminAreaRow({ ...result.area!, ordersCount30d: 0 }));
});

adminAreasRouter.patch("/:id", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const settings = await getStoreSettings();
  const result = await updateDeliveryArea(req.params.id, req.body, settings, req.user!, req);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({
    ...serializeAdminAreaRow({ ...result.area!, ordersCount30d: 0 }),
    chargeWarning: result.chargeWarning,
  });
});

adminAreasRouter.post("/:id/rename", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const settings = await getStoreSettings();
  const result = await updateDeliveryArea(
    req.params.id,
    { name: req.body.name },
    settings,
    req.user!,
    req
  );
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(serializeAdminAreaRow({ ...result.area!, ordersCount30d: 0 }));
});

adminAreasRouter.post("/:id/archive", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const result = await archiveDeliveryArea(req.params.id, req.user!, req, false);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(serializeAdminAreaRow({ ...result.area!, ordersCount30d: 0 }));
});

adminAreasRouter.post("/:id/restore", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const result = await archiveDeliveryArea(req.params.id, req.user!, req, true);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(serializeAdminAreaRow({ ...result.area!, ordersCount30d: 0 }));
});

adminAreasRouter.delete("/:id", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const result = await deleteDeliveryAreaIfAllowed(req.params.id, req.user!, req);
  if (result.error) return res.status(result.status).json({ error: result.error, usage: result.usage });
  res.json({ ok: true, usage: result.usage });
});

adminAreasRouter.post("/reorder", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) return res.status(400).json({ error: "ids array is required." });
  await reorderDeliveryAreas(ids, req.user!, req);
  res.json({ ok: true });
});

adminAreasRouter.post("/bulk", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const action = String(req.body.action || "");
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  if (!action || !ids.length) return res.status(400).json({ error: "action and ids are required." });
  const results = await bulkDeliveryAreas(action, ids, req.body, req.user!, req);
  res.json({ results });
});

adminAreasRouter.post("/pause", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const settings = await getStoreSettings();
  const scope = req.body.scope === "areas" ? "areas" : "all";
  const areaIds = scope === "areas" && Array.isArray(req.body.areaIds)
    ? req.body.areaIds.map(String)
    : [];
  const duration = req.body.duration as
    | { kind: "until_resume" }
    | { kind: "hours"; hours: number }
    | { kind: "until"; at: string }
    | { kind: "end_of_store_day" }
    | undefined;
  const until = duration
    ? resolvePauseUntil(
        duration.kind === "until"
          ? { kind: "until", at: new Date(duration.at) }
          : duration,
        settings.timezone
      )
    : null;
  const pause = await prisma.deliveryPause.create({
    data: {
      scope,
      areaIds,
      pausedById: req.user!.id,
      until,
      reason: String(req.body.reason || "").slice(0, 500),
    },
    include: { pausedBy: { select: { id: true, name: true } } },
  });
  if (scope === "areas") {
    await prisma.deliveryArea.updateMany({
      where: { id: { in: areaIds } },
      data: { isDelivering: false },
    });
  } else {
    await prisma.deliveryArea.updateMany({
      where: { archivedAt: null },
      data: { isDelivering: false },
    });
  }
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.DELIVERY_PAUSED,
    entityType: "delivery_pause",
    entityId: pause.id,
    after: {
      scope,
      areaIds,
      until: pause.until?.toISOString() ?? null,
      reason: pause.reason,
    },
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  res.status(201).json({
    id: pause.id,
    scope: pause.scope,
    areaIds: pause.areaIds,
    pausedAt: pause.pausedAt.toISOString(),
    until: pause.until?.toISOString() ?? null,
    reason: pause.reason,
    pausedBy: pause.pausedBy,
  });
});

adminAreasRouter.post("/resume", requireAuth, requireRole(...EDIT_ROLES), async (req, res) => {
  const pauseId = req.body.pauseId ? String(req.body.pauseId) : null;
  const now = new Date();
  if (pauseId) {
    await prisma.deliveryPause.updateMany({
      where: { id: pauseId, resumedAt: null },
      data: { resumedAt: now },
    });
  } else {
    await prisma.deliveryPause.updateMany({
      where: { resumedAt: null },
      data: { resumedAt: now },
    });
  }
  const areaIds = Array.isArray(req.body.areaIds) ? req.body.areaIds.map(String) : [];
  if (areaIds.length) {
    await prisma.deliveryArea.updateMany({
      where: { id: { in: areaIds } },
      data: { isDelivering: true },
    });
  } else if (!pauseId) {
    await prisma.deliveryArea.updateMany({
      where: { archivedAt: null },
      data: { isDelivering: true },
    });
  }
  await writeAudit(prisma, {
    actorId: req.user!.id,
    actorRole: req.user!.role,
    action: AuditAction.DELIVERY_RESUMED,
    entityType: "delivery_pause",
    entityId: pauseId ?? "all",
    after: { areaIds, resumedAt: now.toISOString() },
    ip: clientIp(req),
  });
  await invalidateDeliveryAreas();
  const pauses = await loadActivePauses(getRestaurantId());
  res.json({ ok: true, activePauses: pauses.length });
});
