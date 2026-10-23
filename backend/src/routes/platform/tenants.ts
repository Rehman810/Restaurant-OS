import { Router } from "express";
import { SubscriptionStatus, TenantStatus } from "@prisma/client";
import { loadSubscriptionTimelineForRestaurant } from "../../lib/platform/subscription-context";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import {
  assertTenantStatusTransition,
  lifecycleScheduleForStatus,
} from "../../lib/platform/tenant-lifecycle";
import { invalidateTenantHostCache } from "../../lib/tenant-resolve";
import { parseProvisionTenantBody } from "../../lib/platform/provision-parse";
import { provisionTenant } from "../../lib/platform/provision";
import { createTenantSupportSession } from "../../lib/platform/support-access";
import { computeTenantHealthScore } from "../../lib/platform/tenant-health";
import { loadTenantUsageSummary } from "../../lib/platform/tenant-usage-summary";
import { parsePlanEntitlementsInput } from "../../lib/platform/plan-catalog";
import { listFeatureFlagsForTenant } from "../../lib/platform/feature-flags";

export const platformTenantsRouter = Router();

platformTenantsRouter.post("/", requirePlatformAuth, requirePlatformPermission("tenants:write"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const result = await provisionTenant(parseProvisionTenantBody(body));
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "tenant.provisioned",
      entityType: "restaurant",
      entityId: result.restaurant.id,
      subjectTenantId: result.restaurant.id,
      after: {
        slug: result.restaurant.slug,
        planSlug: result.planSlug,
        deliveryAreasSeeded: result.deliveryAreasSeeded,
        starterMenu: result.starterMenu,
      },
      ip: clientIp(req),
    });
    res.status(201).json({
      tenant: result.restaurant,
      branchId: result.branchId,
      ownerUserId: result.ownerUserId,
      deliveryAreasSeeded: result.deliveryAreasSeeded,
      starterMenu: result.starterMenu,
    });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : undefined;
    const message = err instanceof Error ? err.message : "Could not create tenant.";
    return res.status(status).json({ error: message, code });
  }
});

platformTenantsRouter.get("/", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const status = String(req.query.status || "").trim();
  const testFilter = String(req.query.test || "").trim();
  const rows = await basePrisma.restaurant.findMany({
    where: {
      ...(testFilter === "test" ? { isTest: true } : testFilter === "real" ? { isTest: false } : {}),
      ...(status ? { status: status as TenantStatus } : {}),
      ...(q
        ? {
            OR: [
              { slug: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { ownerEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      subscription: { include: { plan: { select: { slug: true, name: true } } } },
    },
  });
  res.json({
    tenants: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      displayName: r.displayName,
      isTest: r.isTest,
      hostname: r.hostname,
      status: r.status,
      statusReason: r.statusReason,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      city: r.city,
      createdAt: r.createdAt,
      subscription: r.subscription
        ? {
            status: r.subscription.status,
            plan: r.subscription.plan,
            currentPeriodEnd: r.subscription.currentPeriodEnd,
          }
        : null,
    })),
  });
});

platformTenantsRouter.get(
  "/:id/health",
  requirePlatformAuth,
  requirePlatformPermission("tenants:read"),
  async (req, res) => {
    const restaurant = await basePrisma.restaurant.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!restaurant) return res.status(404).json({ error: "Not found." });
    res.json(await computeTenantHealthScore(restaurant.id));
  }
);

platformTenantsRouter.get(
  "/:id/feature-flags",
  requirePlatformAuth,
  requirePlatformPermission("flags:read"),
  async (req, res) => {
    const restaurant = await basePrisma.restaurant.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!restaurant) return res.status(404).json({ error: "Not found." });
    const flags = await listFeatureFlagsForTenant(restaurant.id);
    res.json({ flags });
  }
);

platformTenantsRouter.get(
  "/:id/usage-summary",
  requirePlatformAuth,
  requirePlatformPermission("tenants:read"),
  async (req, res) => {
    const restaurant = await basePrisma.restaurant.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!restaurant) return res.status(404).json({ error: "Not found." });
    const summary = await loadTenantUsageSummary(restaurant.id);
    if (!summary) return res.status(404).json({ error: "Not found." });
    res.json({ summary });
  }
);

platformTenantsRouter.get("/:id", requirePlatformAuth, requirePlatformPermission("tenants:read"), async (req, res) => {
  const row = await basePrisma.restaurant.findUnique({
    where: { id: req.params.id },
    include: {
      subscription: { include: { plan: true } },
      domains: true,
      notes: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!row) return res.status(404).json({ error: "Not found." });
  const subCtx = await loadSubscriptionTimelineForRestaurant(row.id, true);
  res.json({
    tenant: {
      ...row,
      subscriptionTimeline: subCtx?.timeline ?? null,
      tenantAccess: subCtx?.tenant ?? null,
    },
  });
});

platformTenantsRouter.patch(
  "/:id",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const { status, statusReason, displayName, ownerEmail, ownerPhone, city, hostname, isTest, tags } = req.body as {
      status?: TenantStatus;
      statusReason?: string;
      displayName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
      city?: string;
      hostname?: string | null;
      isTest?: boolean;
      tags?: string[];
    };
    const existing = await basePrisma.restaurant.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Not found." });

    const data: Record<string, unknown> = {};
    if (status) {
      try {
        assertTenantStatusTransition(existing.status, status);
      } catch (err) {
        const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : undefined;
        const message = err instanceof Error ? err.message : "Invalid status.";
        return res.status(400).json({ error: message, code });
      }
      data.status = status;
      data.statusChangedAt = new Date();
      Object.assign(data, lifecycleScheduleForStatus(status));
    }
    if (statusReason !== undefined) data.statusReason = String(statusReason).trim();
    if (displayName !== undefined) data.displayName = String(displayName).trim();
    if (ownerEmail !== undefined) data.ownerEmail = String(ownerEmail).trim();
    if (ownerPhone !== undefined) data.ownerPhone = String(ownerPhone).trim();
    if (city !== undefined) data.city = String(city).trim();
    if (isTest !== undefined) data.isTest = Boolean(isTest);
    if (tags !== undefined) {
      data.tags = Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : [];
    }
    if (hostname !== undefined) {
      const nextHost = hostname ? String(hostname).trim().toLowerCase() : null;
      if (nextHost) {
        const hostTaken =
          (await basePrisma.restaurant.findFirst({
            where: { hostname: nextHost, id: { not: existing.id } },
            select: { id: true },
          })) ||
          (await basePrisma.tenantDomain.findFirst({ where: { hostname: nextHost }, select: { id: true } }));
        if (hostTaken) {
          return res.status(409).json({ error: "That hostname is already in use.", code: "HOST_TAKEN" });
        }
      }
      data.hostname = nextHost;
    }

    const updated = await basePrisma.restaurant.update({
      where: { id: req.params.id },
      data,
    });
    invalidateTenantHostCache(existing.hostname || undefined);
    invalidateTenantHostCache(existing.slug);
    invalidateTenantHostCache(updated.hostname || undefined);
    invalidateTenantHostCache(updated.slug);
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "tenant.updated",
      entityType: "restaurant",
      entityId: updated.id,
      subjectTenantId: updated.id,
      before: { status: existing.status, statusReason: existing.statusReason },
      after: { status: updated.status, statusReason: updated.statusReason },
      ip: clientIp(req),
    });
    res.json({ tenant: updated });
  }
);

platformTenantsRouter.patch(
  "/:id/subscription",
  requirePlatformAuth,
  requirePlatformPermission("tenants:write"),
  async (req, res) => {
    const { planId, status, trialEndsAt, currentPeriodEnd, pinnedPlanVersionId, entitlementOverrides } = req.body as {
      planId?: string;
      status?: SubscriptionStatus;
      trialEndsAt?: string | null;
      currentPeriodEnd?: string;
      pinnedPlanVersionId?: string | null;
      entitlementOverrides?: Record<string, unknown>;
    };
    const restaurantId = req.params.id;
    const sub = await basePrisma.subscription.findUnique({ where: { restaurantId } });
    if (!sub) return res.status(404).json({ error: "Subscription not found." });

    const data: Record<string, unknown> = {};
    if (planId) data.planId = planId;
    if (status) data.status = status;
    if (trialEndsAt !== undefined) data.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    if (currentPeriodEnd) data.currentPeriodEnd = new Date(currentPeriodEnd);
    if (pinnedPlanVersionId !== undefined) {
      if (pinnedPlanVersionId === null || pinnedPlanVersionId === "") {
        data.pinnedPlanVersionId = null;
      } else {
        const version = await basePrisma.planVersion.findFirst({
          where: { id: pinnedPlanVersionId, planId: sub.planId },
          select: { id: true },
        });
        if (!version) return res.status(400).json({ error: "Plan version does not belong to the current plan." });
        data.pinnedPlanVersionId = version.id;
      }
    }
    if (entitlementOverrides !== undefined) {
      data.entitlementOverrides = parsePlanEntitlementsInput(entitlementOverrides);
    }

    const updated = await basePrisma.subscription.update({
      where: { id: sub.id },
      data,
      include: { plan: true },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "subscription.updated",
      entityType: "subscription",
      entityId: updated.id,
      subjectTenantId: restaurantId,
      after: { planId: updated.planId, status: updated.status },
      ip: clientIp(req),
    });
    res.json({ subscription: updated });
  }
);

platformTenantsRouter.post(
  "/:id/support-sessions",
  requirePlatformAuth,
  requirePlatformPermission("support:write"),
  async (req, res) => {
    const restaurant = await basePrisma.restaurant.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!restaurant) return res.status(404).json({ error: "Not found." });
    const ttlHours = req.body?.ttlHours != null ? Number(req.body.ttlHours) : undefined;
    const session = await createTenantSupportSession({
      subjectRestaurantId: restaurant.id,
      platformUserId: req.platformUser!.id,
      platformEmail: req.platformUser!.email,
      ttlHours,
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "support_session.created",
      entityType: "tenant_support_session",
      entityId: session.sessionId,
      subjectTenantId: restaurant.id,
      after: { expiresAt: session.expiresAt },
      ip: clientIp(req),
    });
    res.status(201).json({
      sessionId: session.sessionId,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  }
);

platformTenantsRouter.post(
  "/:id/notes",
  requirePlatformAuth,
  requirePlatformPermission("notes:write"),
  async (req, res) => {
    const body = String((req.body as { body?: string }).body || "").trim();
    if (!body) return res.status(400).json({ error: "Note text is required." });
    const restaurant = await basePrisma.restaurant.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!restaurant) return res.status(404).json({ error: "Not found." });
    const note = await basePrisma.restaurantNote.create({
      data: { restaurantId: restaurant.id, body },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "tenant.note_created",
      entityType: "restaurant_note",
      entityId: note.id,
      subjectTenantId: restaurant.id,
      ip: clientIp(req),
    });
    res.status(201).json({ note });
  }
);
