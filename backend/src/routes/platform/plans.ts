import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { basePrisma } from "../../lib/prisma-base";
import { writePlatformAudit } from "../../lib/platform/platform-audit";
import { clientIp } from "../../lib/client-ip";
import { normalizePlanSlug, parsePlanEntitlementsInput, parsePlanInterval } from "../../lib/platform/plan-catalog";

export const platformPlansRouter = Router();

platformPlansRouter.get("/", requirePlatformAuth, requirePlatformPermission("plans:read"), async (req, res) => {
  const includeAll = req.query.all === "1" || req.query.includeInactive === "1";
  const plans = await basePrisma.plan.findMany({
    where: includeAll ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { subscriptions: true } },
    },
  });
  res.json({
    plans: plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      interval: p.interval,
      pricePkr: p.pricePkr,
      currency: p.currency,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      entitlements: p.entitlements,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      subscriberCount: p._count.subscriptions,
    })),
  });
});

platformPlansRouter.get("/:id", requirePlatformAuth, requirePlatformPermission("plans:read"), async (req, res) => {
  const plan = await basePrisma.plan.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) return res.status(404).json({ error: "Not found." });
  res.json({
    plan: {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      interval: plan.interval,
      pricePkr: plan.pricePkr,
      currency: plan.currency,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      entitlements: plan.entitlements,
      subscriberCount: plan._count.subscriptions,
    },
  });
});

platformPlansRouter.post("/", requirePlatformAuth, requirePlatformPermission("plans:write"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  try {
    const slug = normalizePlanSlug(String(body.slug || ""));
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Plan name is required." });
    const existing = await basePrisma.plan.findUnique({ where: { slug }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "That plan slug is already in use.", code: "SLUG_TAKEN" });

    const entitlements = parsePlanEntitlementsInput(body.entitlements ?? {});
    const pricePkr = Math.max(0, Math.round(Number(body.pricePkr) || 0));
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.round(Number(body.sortOrder)) : 0;

    const plan = await basePrisma.plan.create({
      data: {
        slug,
        name,
        description: String(body.description || "").trim(),
        interval: parsePlanInterval(body.interval),
        pricePkr,
        currency: String(body.currency || "PKR").trim() || "PKR",
        isActive: body.isActive !== false,
        sortOrder,
        entitlements,
      },
    });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "plan.created",
      entityType: "plan",
      entityId: plan.id,
      after: { slug: plan.slug, name: plan.name },
      ip: clientIp(req),
    });
    res.status(201).json({ plan });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Could not create plan.";
    return res.status(status).json({ error: message });
  }
});

platformPlansRouter.patch("/:id", requirePlatformAuth, requirePlatformPermission("plans:write"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const existing = await basePrisma.plan.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found." });

  try {
    const data: Record<string, unknown> = {};
    if (body.slug !== undefined) {
      const slug = normalizePlanSlug(String(body.slug));
      const taken = await basePrisma.plan.findFirst({ where: { slug, id: { not: existing.id } }, select: { id: true } });
      if (taken) return res.status(409).json({ error: "That plan slug is already in use.", code: "SLUG_TAKEN" });
      data.slug = slug;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return res.status(400).json({ error: "Plan name is required." });
      data.name = name;
    }
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.interval !== undefined) data.interval = parsePlanInterval(body.interval);
    if (body.pricePkr !== undefined) data.pricePkr = Math.max(0, Math.round(Number(body.pricePkr)));
    if (body.currency !== undefined) data.currency = String(body.currency).trim() || "PKR";
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder));
    if (body.entitlements !== undefined) data.entitlements = parsePlanEntitlementsInput(body.entitlements);

    const plan = await basePrisma.plan.update({ where: { id: existing.id }, data });
    await writePlatformAudit({
      actorId: req.platformUser!.id,
      actorEmail: req.platformUser!.email,
      action: "plan.updated",
      entityType: "plan",
      entityId: plan.id,
      before: { slug: existing.slug, name: existing.name, isActive: existing.isActive },
      after: { slug: plan.slug, name: plan.name, isActive: plan.isActive },
      ip: clientIp(req),
    });
    res.json({ plan });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    const message = err instanceof Error ? err.message : "Could not update plan.";
    return res.status(status).json({ error: message });
  }
});
