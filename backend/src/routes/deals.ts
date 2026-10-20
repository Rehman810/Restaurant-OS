import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { dealExtrasFromBody, dealWarningsFromItems } from "../lib/admin-menu/deal-payload";
import { notifyMenuChanged } from "../lib/admin-menu/emit";

const DEAL_CATEGORY_PRESETS = [
  "Summer deals",
  "Winter deals",
  "Ramadan specials",
  "Weekend combos",
  "Family packs",
  "Student deals",
];

function canonicalDealCategory(value: unknown) {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return DEAL_CATEGORY_PRESETS.find((name) => name.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

export const dealsRouter = Router();

const dealInclude = {
  items: {
    include: {
      menuItem: {
        select: { id: true, name: true, price: true, imageUrl: true, category: true, archivedAt: true },
      },
    },
  },
};

dealsRouter.get("/", async (req, res) => {
  const activeOnly = req.query.active === "true";
  const categoryRaw = String(req.query.category || "").trim();
  const category = categoryRaw ? canonicalDealCategory(categoryRaw) : "";
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 500));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim();

  const where = {
    ...(activeOnly ? { isActive: true } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: dealInclude,
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.deal.count({ where }),
  ]);

  res.json({ deals, total, limit, offset });
});

dealsRouter.get("/:id", async (req, res) => {
  const deal = await prisma.deal.findUnique({
    where: { id: req.params.id },
    include: dealInclude,
  });
  if (!deal) return res.status(404).json({ error: "Deal not found." });
  res.json(deal);
});

dealsRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { title, description, category, dealPrice, imageUrl, items } = req.body;
  if (!title || dealPrice == null) {
    return res.status(400).json({ error: "Title and deal price are required." });
  }

  const dealItems = Array.isArray(items) ? items : [];
  if (dealItems.length === 0) {
    return res.status(400).json({ error: "Add at least one menu item to the deal." });
  }

  const extras = dealExtrasFromBody(req.body as Record<string, unknown>);
  const menuRows = await prisma.menuItem.findMany({
    where: { id: { in: dealItems.map((r: { menuItemId: string }) => r.menuItemId) } },
    select: { id: true, price: true, archivedAt: true },
  });
  if (menuRows.some((m) => m.archivedAt)) {
    return res.status(400).json({ error: "Cannot add archived dishes to a deal." });
  }

  const deal = await prisma.deal.create({
    data: {
      title: String(title).trim(),
      description: description || "",
      category: canonicalDealCategory(category),
      dealPrice: Number(dealPrice),
      imageUrl: imageUrl || "",
      isActive: extras.isActive,
      isVisible: extras.isVisible,
      channelOnline: extras.channelOnline,
      channelPos: extras.channelPos,
      channelDineIn: extras.channelDineIn,
      perOrderLimit: extras.perOrderLimit,
      ...(extras.scheduleDays !== undefined && { scheduleDays: extras.scheduleDays }),
      ...(extras.scheduleStartMinutes !== undefined && { scheduleStartMinutes: extras.scheduleStartMinutes }),
      ...(extras.scheduleEndMinutes !== undefined && { scheduleEndMinutes: extras.scheduleEndMinutes }),
      ...(extras.scheduleStartsAt !== undefined && { scheduleStartsAt: extras.scheduleStartsAt }),
      ...(extras.scheduleEndsAt !== undefined && { scheduleEndsAt: extras.scheduleEndsAt }),
      items: {
        create: dealItems.map((row: { menuItemId: string; quantity?: number }) => ({
          menuItemId: row.menuItemId,
          quantity: row.quantity ?? 1,
        })),
      },
    },
    include: dealInclude,
  });
  const warnings = dealWarningsFromItems(Number(dealPrice), deal.items);
  notifyMenuChanged();
  res.status(201).json({ deal, warnings });
});

dealsRouter.put("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { title, description, category, dealPrice, imageUrl, isActive, items } = req.body;
  const extras = dealExtrasFromBody(req.body as Record<string, unknown>);

  try {
    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Deal not found." });

    if (Array.isArray(items)) {
      if (items.length === 0) {
        return res.status(400).json({ error: "Add at least one menu item to the deal." });
      }
      await prisma.dealItem.deleteMany({ where: { dealId: req.params.id } });
      if (items.length > 0) {
        await prisma.dealItem.createMany({
          data: items.map((row: { menuItemId: string; quantity?: number }) => ({
            dealId: req.params.id,
            menuItemId: row.menuItemId,
            quantity: row.quantity ?? 1,
          })),
        });
      }
    }

    const deal = await prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id: req.params.id },
        data: {
          ...(title != null && { title: String(title).trim() }),
          ...(description != null && { description }),
          ...(category != null && { category: canonicalDealCategory(category) }),
          ...(dealPrice != null && { dealPrice: Number(dealPrice) }),
          ...(imageUrl != null && { imageUrl }),
          ...(isActive != null && { isActive, isVisible: isActive }),
          ...(req.body.isVisible !== undefined && {
            isVisible: req.body.isVisible !== false,
            isActive: req.body.isVisible !== false,
          }),
          channelOnline: extras.channelOnline,
          channelPos: extras.channelPos,
          channelDineIn: extras.channelDineIn,
          perOrderLimit: extras.perOrderLimit,
          ...(extras.scheduleDays !== undefined && { scheduleDays: extras.scheduleDays }),
          ...(extras.scheduleStartMinutes !== undefined && { scheduleStartMinutes: extras.scheduleStartMinutes }),
          ...(extras.scheduleEndMinutes !== undefined && { scheduleEndMinutes: extras.scheduleEndMinutes }),
          ...(extras.scheduleStartsAt !== undefined && { scheduleStartsAt: extras.scheduleStartsAt }),
          ...(extras.scheduleEndsAt !== undefined && { scheduleEndsAt: extras.scheduleEndsAt }),
        },
        include: dealInclude,
      });
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        action: AuditAction.DEAL_CHANGED,
        entityType: "deal",
        entityId: updated.id,
        before: {
          title: existing.title,
          dealPrice: existing.dealPrice,
          isActive: existing.isActive,
        },
        after: {
          title: updated.title,
          dealPrice: updated.dealPrice,
          isActive: updated.isActive,
        },
        ip: clientIp(req),
      });
      return updated;
    });
    const warnings = dealWarningsFromItems(Number(deal.dealPrice), deal.items);
    notifyMenuChanged();
    res.json({ deal, warnings });
  } catch {
    res.status(404).json({ error: "Deal not found." });
  }
});

dealsRouter.delete("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    await prisma.deal.delete({ where: { id: req.params.id } });
    notifyMenuChanged();
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Deal not found." });
  }
});
