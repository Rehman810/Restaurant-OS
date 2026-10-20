import { Router } from "express";
import { Role } from "@prisma/client";
import { defaultsForCategory, enrichCategory } from "../lib/category-meta";
import { parseCategoryScheduleBody } from "../lib/admin-menu/category-mutations";
import { notifyMenuChanged } from "../lib/admin-menu/emit";
import { prisma } from "../lib/prisma";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 500));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { tagline: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.category.count({ where }),
  ]);

  res.json({ categories: categories.map(enrichCategory), total, limit, offset });
});

categoriesRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Category name is required." });

  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) return res.status(409).json({ error: "Category already exists." });

  const defaults = defaultsForCategory(name);
  const maxOrder = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const schedule = parseCategoryScheduleBody(req.body);
  const category = await prisma.category.create({
    data: {
      name,
      tagline: String(req.body.tagline || defaults.tagline).trim(),
      imageUrl: String(req.body.imageUrl || defaults.imageUrl).trim(),
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      isVisible: req.body.isVisible !== false,
      ...(schedule.scheduleDays !== undefined ? { scheduleDays: schedule.scheduleDays } : {}),
      ...(schedule.scheduleStartMinutes !== undefined ? { scheduleStartMinutes: schedule.scheduleStartMinutes } : {}),
      ...(schedule.scheduleEndMinutes !== undefined ? { scheduleEndMinutes: schedule.scheduleEndMinutes } : {}),
    },
  });
  notifyMenuChanged();
  res.status(201).json(enrichCategory(category));
});

categoriesRouter.put("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) return res.status(404).json({ error: "Category not found." });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
  const tagline = req.body.tagline !== undefined ? String(req.body.tagline).trim() : undefined;
  const imageUrl = req.body.imageUrl !== undefined ? String(req.body.imageUrl).trim() : undefined;

  if (name !== undefined && !name) {
    return res.status(400).json({ error: "Category name is required." });
  }

  if (name && name !== category.name) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: "Category name already exists." });
    await prisma.menuItem.updateMany({
      where: { category: category.name },
      data: { category: name },
    });
  }

  const schedule = parseCategoryScheduleBody(req.body);
  const updated = await prisma.category.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(req.body.isVisible !== undefined ? { isVisible: req.body.isVisible !== false } : {}),
      ...(schedule.scheduleDays !== undefined ? { scheduleDays: schedule.scheduleDays } : {}),
      ...(schedule.scheduleStartMinutes !== undefined ? { scheduleStartMinutes: schedule.scheduleStartMinutes } : {}),
      ...(schedule.scheduleEndMinutes !== undefined ? { scheduleEndMinutes: schedule.scheduleEndMinutes } : {}),
    },
  });
  notifyMenuChanged();
  res.json(enrichCategory(updated));
});

categoriesRouter.delete("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { deleteCategory } = await import("../lib/admin-menu/category-mutations");
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
