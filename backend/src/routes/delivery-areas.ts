import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { getStoreSettings } from "../lib/settings-data";
import { loadActivePauses, areaIsPausedByRecords } from "../lib/delivery/pause";
import { serializePublicArea } from "../lib/delivery/serialize";
import {
  bumpDeliveryAreasPublicCache,
  getDeliveryAreasCacheVersion,
  readDeliveryAreasPublicCache,
  writeDeliveryAreasPublicCache,
} from "../lib/delivery/public-cache";
import { listAdminAreas } from "../lib/delivery/list-admin";
import { getRestaurantId } from "../lib/restaurant-context";

export const deliveryAreasRouter = Router();

async function buildPublicPayload(branchId?: string) {
  const settings = await getStoreSettings();
  const pauses = await loadActivePauses(getRestaurantId());
  const globalPaused = pauses.some((p) => p.scope === "all");
  const areas = await prisma.deliveryArea.findMany({
    where: { archivedAt: null, isActive: true, isDelivering: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { branchLinks: { select: { branchId: true } } },
  });
  const filtered = areas.filter((area) => {
    if (globalPaused || areaIsPausedByRecords(area.id, pauses)) return false;
    if (!branchId) return true;
    if (!area.branchLinks.length) return true;
    return area.branchLinks.some((l) => l.branchId === branchId);
  });
  return {
    paused: globalPaused,
    pausedMessage: globalPaused
      ? "Delivery is temporarily paused. You can still order pickup if available."
      : null,
    cacheVersion: getDeliveryAreasCacheVersion(),
    areas: filtered.map((a) =>
      serializePublicArea(a, settings, areaIsPausedByRecords(a.id, pauses))
    ),
    settings: {
      minimumOrder: Number(settings.minimumOrder),
      freeDeliveryAbove:
        settings.freeDeliveryAbove != null ? Number(settings.freeDeliveryAbove) : null,
      deliveryEstimateMin: settings.deliveryEstimateMin,
      deliveryEstimateMax: settings.deliveryEstimateMax,
    },
  };
}

/** Public: active, non-paused areas for storefront/POS */
deliveryAreasRouter.get("/", async (req, res) => {
  const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
  const v = getDeliveryAreasCacheVersion();
  const cached = readDeliveryAreasPublicCache<Record<string, unknown>>(v);
  if (cached && !branchId) {
    return res.json(cached);
  }
  const out = await buildPublicPayload(branchId);
  if (!branchId) writeDeliveryAreasPublicCache(v, out);
  res.setHeader("X-Delivery-Areas-Version", String(v));
  res.json(out);
});

deliveryAreasRouter.get("/preview", async (req, res) => {
  const { computeDeliveryFee } = await import("../lib/delivery/fee");
  const areaId = String(req.query.areaId || "");
  const subtotal = Number(req.query.subtotal || 0);
  if (!areaId) return res.status(400).json({ error: "areaId is required." });
  const settings = await getStoreSettings();
  const area = await prisma.deliveryArea.findFirst({
    where: { id: areaId, archivedAt: null, isActive: true },
  });
  if (!area) return res.status(404).json({ error: "Area not found." });
  const pauses = await loadActivePauses(getRestaurantId());
  if (areaIsPausedByRecords(area.id, pauses) || !area.isDelivering) {
    return res.status(400).json({ error: "Delivery to this area is paused." });
  }
  const fee = computeDeliveryFee(
    {
      deliveryCharge: Number(area.deliveryCharge),
      minOrder: area.minOrder != null ? Number(area.minOrder) : null,
      freeAbove: area.freeAbove != null ? Number(area.freeAbove) : null,
      etaMinMinutes: area.etaMinMinutes,
      etaMaxMinutes: area.etaMaxMinutes,
    },
    subtotal,
    settings
  );
  res.json(fee);
});

/** Legacy admin list — prefer GET /admin/areas */
deliveryAreasRouter.get("/all", requireAuth, requireRole(...ADMIN_LIKE), async (_req, res) => {
  const data = await listAdminAreas(getRestaurantId(), { pageSize: 500 });
  res.json(data.rows);
});

deliveryAreasRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  bumpDeliveryAreasPublicCache();
  const { createDeliveryArea } = await import("../lib/delivery/mutations");
  const settings = await getStoreSettings();
  const result = await createDeliveryArea(req.body, settings, req.user!, req);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(result.status).json(result.area);
});

deliveryAreasRouter.patch("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { updateDeliveryArea } = await import("../lib/delivery/mutations");
  const settings = await getStoreSettings();
  const result = await updateDeliveryArea(req.params.id, req.body, settings, req.user!, req);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result.area);
});
