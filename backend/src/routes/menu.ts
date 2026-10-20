import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { effectiveItemPrice } from "../lib/store-settings";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { getDefaultBranchId } from "../lib/branch-scope";
import { getStoreSettings } from "../lib/settings-data";
import { evaluateCategorySchedule } from "../lib/admin-menu/category-schedule";
import { categoryOrderMap, compareMenuItems } from "../lib/admin-menu/menu-sort";
import { resolveAvailability } from "../lib/admin-menu/availability";
import { notifyMenuChanged } from "../lib/admin-menu/emit";

export const menuRouter = Router();

const menuInclude = {
  optionGroups: {
    orderBy: { sortOrder: "asc" as const },
    include: { options: { orderBy: { sortOrder: "asc" as const } } },
  },
  sizes: { orderBy: { sortOrder: "asc" as const } },
  addons: { orderBy: { sortOrder: "asc" as const } },
  printStation: { select: { id: true, name: true, code: true } },
};

type OptionRow = {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  sortOrder: number;
};

type GroupRow = {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: OptionRow[];
};

function serializeOptionGroups(item: {
  optionGroups?: {
    id: string;
    name: string;
    required: boolean;
    sortOrder: number;
    options: { id: string; name: string; price: { toString(): string }; discountPrice?: { toString(): string } | null; sortOrder: number }[];
  }[];
  sizes?: { id: string; name: string; price: { toString(): string }; sortOrder: number }[];
}): GroupRow[] {
  if (item.optionGroups?.length) {
    return item.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      required: g.required,
      sortOrder: g.sortOrder,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.price),
        discountPrice: o.discountPrice != null ? Number(o.discountPrice) : null,
        sortOrder: o.sortOrder,
      })),
    }));
  }
  if (item.sizes?.length) {
    return [
      {
        id: "legacy-sizes",
        name: "Choose an option",
        required: true,
        sortOrder: 1,
        options: item.sizes.map((s) => ({
          id: s.id,
          name: s.name,
          price: Number(s.price),
          discountPrice: null,
          sortOrder: s.sortOrder,
        })),
      },
    ];
  }
  return [];
}

function serializeMenuItem(item: {
  price: { toString(): string };
  discountPrice?: { toString(): string } | null;
  addons?: { id: string; name: string; price: { toString(): string }; sortOrder: number }[];
  [key: string]: unknown;
}) {
  const effective = effectiveItemPrice(item);
  const optionGroups = serializeOptionGroups(item as Parameters<typeof serializeOptionGroups>[0]);
  return {
    ...item,
    price: Number(item.price),
    discountPrice: item.discountPrice != null ? Number(item.discountPrice) : null,
    effectivePrice: effective,
    optionGroups,
    addons:
      (item.addons as { id: string; name: string; price: { toString(): string }; sortOrder: number }[])?.map(
        (a) => ({ ...a, price: Number(a.price) })
      ) ?? [],
    sizes: undefined,
  };
}

menuRouter.get("/", async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 500));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = String(req.query.search || "").trim();
  const category = String(req.query.category || "").trim();
  const branchId = String(req.query.branchId || "").trim() || await getDefaultBranchId();
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { timezone: true } });
  const timezone = branch?.timezone || settings.timezone || "Asia/Karachi";

  const categories = await prisma.category.findMany({
    where: { archivedAt: null, isVisible: true },
    select: {
      name: true,
      sortOrder: true,
      isVisible: true,
      archivedAt: true,
      scheduleDays: true,
      scheduleStartMinutes: true,
      scheduleEndMinutes: true,
    },
  });
  const now = new Date();
  const activeCategories = categories.filter((c) => evaluateCategorySchedule(c, now, timezone) === "active");
  const activeCategoryNames = activeCategories.map((c) => c.name);

  if (category && category !== "All" && !activeCategoryNames.includes(category)) {
    return res.json({ items: [], total: 0, limit, offset, branchId });
  }

  const where = {
    archivedAt: null,
    isVisible: true,
    ...(category && category !== "All"
      ? { category }
      : activeCategoryNames.length
        ? { category: { in: activeCategoryNames } }
        : { category: { in: [] as string[] } }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [overrides, items, total] = await Promise.all([
    prisma.menuItemBranchAvailability.findMany({ where: { branchId } }),
    prisma.menuItem.findMany({
      where,
      include: menuInclude,
      take: limit,
      skip: offset,
    }),
    prisma.menuItem.count({ where }),
  ]);
  const catOrder = categoryOrderMap(activeCategories);
  const overrideMap = new Map(overrides.map((o) => [o.menuItemId, o]));
  items.sort((a, b) => compareMenuItems(a, b, catOrder));

  res.json({
    items: items.map((item) => {
      const avail = resolveAvailability(overrideMap.get(item.id) ?? null, timezone, !item.isAvailable);
      const serialized = serializeMenuItem(item);
      return { ...serialized, isAvailable: avail.state === "available" };
    }),
    total,
    limit,
    offset,
    branchId,
  });
});

menuRouter.get("/:id", async (req, res) => {
  const item = await prisma.menuItem.findUnique({
    where: { id: req.params.id },
    include: menuInclude,
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(serializeMenuItem(item));
});

type OptionGroupInput = {
  name: string;
  required?: boolean;
  options?: { name: string; price: number; discountPrice?: number | string | null }[];
};

async function syncOptionGroups(menuItemId: string, groups?: OptionGroupInput[]) {
  if (!groups) return;
  await prisma.menuItemOptionGroup.deleteMany({ where: { menuItemId } });
  await prisma.menuItemSize.deleteMany({ where: { menuItemId } });
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    if (!g.name?.trim()) continue;
    const group = await prisma.menuItemOptionGroup.create({
      data: {
        menuItemId,
        name: g.name.trim(),
        required: g.required ?? true,
        sortOrder: gi + 1,
      },
    });
    for (let oi = 0; oi < (g.options ?? []).length; oi++) {
      const o = g.options![oi];
      if (!o.name?.trim()) continue;
      await prisma.menuItemOption.create({
        data: {
          groupId: group.id,
          name: o.name.trim(),
          price: Number(o.price) || 0,
          discountPrice:
            o.discountPrice != null && String(o.discountPrice) !== ""
              ? Number(o.discountPrice)
              : null,
          sortOrder: oi + 1,
        },
      });
    }
  }
}

async function syncAddons(menuItemId: string, addons?: { name: string; price: number }[]) {
  if (!addons) return;
  await prisma.menuItemAddon.deleteMany({ where: { menuItemId } });
  for (let i = 0; i < addons.length; i++) {
    const row = addons[i];
    if (!row.name?.trim()) continue;
    await prisma.menuItemAddon.create({
      data: { menuItemId, name: row.name.trim(), price: Number(row.price) || 0, sortOrder: i + 1 },
    });
  }
}

menuRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const {
    name,
    description,
    price,
    discountPrice,
    category,
    imageUrl,
    isAvailable,
    optionGroups,
    addons,
    printStationId,
  } = req.body;
  if (!name || price == null || !category) {
    return res.status(400).json({ error: "Name, price and category are required." });
  }
  const item = await prisma.menuItem.create({
    data: {
      name,
      description: description || "",
      price: Number(price),
      discountPrice:
        discountPrice != null && discountPrice !== "" ? Number(discountPrice) : null,
      category,
      printStationId: printStationId ? String(printStationId) : null,
      imageUrl:
        imageUrl ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      isAvailable: isAvailable ?? true,
    },
  });
  await syncOptionGroups(item.id, optionGroups);
  await syncAddons(item.id, addons);
  const full = await prisma.menuItem.findUnique({ where: { id: item.id }, include: menuInclude });
  notifyMenuChanged();
  res.status(201).json(serializeMenuItem(full!));
});

menuRouter.put("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const {
    name,
    description,
    price,
    discountPrice,
    category,
    imageUrl,
    isAvailable,
    optionGroups,
    addons,
    sizes,
    printStationId,
  } = req.body;
  try {
    const prior = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    if (!prior) return res.status(404).json({ error: "Menu item not found." });
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.menuItem.update({
        where: { id: req.params.id },
        data: {
          ...(name != null && { name }),
          ...(description != null && { description }),
          ...(price != null && { price: Number(price) }),
          ...(discountPrice !== undefined && {
            discountPrice:
              discountPrice === null || discountPrice === ""
                ? null
                : Number(discountPrice),
          }),
          ...(category != null && { category }),
          ...(imageUrl != null && { imageUrl }),
          ...(isAvailable != null && { isAvailable }),
          ...(printStationId !== undefined && {
            printStationId: printStationId ? String(printStationId) : null,
          }),
        },
      });
      const priceChanged =
        price != null && Number(prior.price) !== Number(updated.price) ||
        discountPrice !== undefined &&
          String(prior.discountPrice ?? "") !== String(updated.discountPrice ?? "");
      const availChanged = isAvailable != null && prior.isAvailable !== updated.isAvailable;
      if (priceChanged) {
        await writeAudit(tx, {
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: AuditAction.ITEM_PRICE_CHANGED,
          entityType: "menu_item",
          entityId: updated.id,
          before: { price: prior.price, discountPrice: prior.discountPrice },
          after: { price: updated.price, discountPrice: updated.discountPrice },
          ip: clientIp(req),
        });
      }
      if (availChanged) {
        await writeAudit(tx, {
          actorId: req.user!.id,
          actorRole: req.user!.role,
          action: AuditAction.ITEM_AVAILABILITY_CHANGED,
          entityType: "menu_item",
          entityId: updated.id,
          before: { isAvailable: prior.isAvailable },
          after: { isAvailable: updated.isAvailable },
          ip: clientIp(req),
        });
      }
      return updated;
    });
    if (optionGroups !== undefined) {
      await syncOptionGroups(item.id, optionGroups);
    } else if (sizes !== undefined) {
      await syncOptionGroups(item.id, [
        { name: "Choose an option", required: true, options: sizes },
      ]);
    }
    if (addons !== undefined) await syncAddons(item.id, addons);
    const full = await prisma.menuItem.findUnique({ where: { id: item.id }, include: menuInclude });
    notifyMenuChanged();
    res.json(serializeMenuItem(full!));
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

menuRouter.delete("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: req.params.id } });
    notifyMenuChanged();
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});
