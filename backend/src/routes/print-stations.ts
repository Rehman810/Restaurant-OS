import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE, ORDER_OPS } from "../lib/roles";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";

export const printStationsRouter = Router();

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
}

async function resolveBranchId(req: { query: Record<string, unknown> }) {
  const scope = await resolveBranchScope(req as never);
  if (scope.allBranches) return getDefaultBranchId();
  return scope.branchId!;
}

printStationsRouter.get("/", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  try {
    const branchId = await resolveBranchId(req);
    const stations = await prisma.printStation.findMany({
      where: { branchId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    res.json({ stations });
  } catch (err) {
    return branchScopeError(res, err);
  }
});

printStationsRouter.post("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  if (scope.allBranches) {
    return res.status(400).json({ error: "Select a branch before adding a print station." });
  }
  const { name, code, sortOrder, isActive, isDefault } = req.body as {
    name?: string;
    code?: string;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
  };
  const trimmed = name?.trim();
  const stationCode = normalizeCode(code || trimmed || "");
  if (!trimmed || !stationCode) {
    return res.status(400).json({ error: "Name and code are required." });
  }
  if (isDefault) {
    await prisma.printStation.updateMany({
      where: { branchId: scope.branchId!, isDefault: true },
      data: { isDefault: false },
    });
  }
  const station = await prisma.printStation.create({
    data: {
      branchId: scope.branchId!,
      name: trimmed,
      code: stationCode,
      sortOrder: Number(sortOrder) || 0,
      isActive: isActive !== false,
      isDefault: Boolean(isDefault),
    },
  });
  res.status(201).json(station);
});

printStationsRouter.patch("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const existing = await prisma.printStation.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Station not found." });
  if (!scope.allBranches && existing.branchId !== scope.branchId) {
    return res.status(403).json({ error: "Station is outside your branch." });
  }
  const { name, code, sortOrder, isActive, isDefault } = req.body as {
    name?: string;
    code?: string;
    sortOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
  };
  if (isDefault) {
    await prisma.printStation.updateMany({
      where: { branchId: existing.branchId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const station = await prisma.printStation.update({
    where: { id: existing.id },
    data: {
      ...(name != null ? { name: name.trim() } : {}),
      ...(code != null ? { code: normalizeCode(code) } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive != null ? { isActive: Boolean(isActive) } : {}),
      ...(isDefault != null ? { isDefault: Boolean(isDefault) } : {}),
    },
  });
  res.json(station);
});

printStationsRouter.delete("/:id", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const existing = await prisma.printStation.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Station not found." });
  if (!scope.allBranches && existing.branchId !== scope.branchId) {
    return res.status(403).json({ error: "Station is outside your branch." });
  }
  if (existing.isDefault) {
    return res.status(400).json({ error: "Cannot delete the default station. Set another default first." });
  }
  await prisma.menuItem.updateMany({
    where: { printStationId: existing.id },
    data: { printStationId: null },
  });
  await prisma.printStation.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
