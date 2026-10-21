import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getDefaultBranchId, listBranchesForUser } from "../lib/branch-scope";
import { requireAuth, requireRole } from "../middleware/auth";

export const branchesRouter = Router();

import { STAFF_DIRECTORY_ROLES } from "../lib/roles";

const STAFF_ROLES = STAFF_DIRECTORY_ROLES;

branchesRouter.get("/", requireAuth, requireRole(...STAFF_ROLES), async (req, res) => {
  const branches = await listBranchesForUser(req.user!);
  const defaultBranchId = await getDefaultBranchId();
  res.json({ branches, defaultBranchId });
});

branchesRouter.get("/default", async (_req, res) => {
  const id = await getDefaultBranchId();
  const branch = await prisma.branch.findUnique({ where: { id } });
  res.json({ branch });
});

/** Active outlets for storefront pickup / delivery routing (no auth). */
branchesRouter.get("/public", async (_req, res) => {
  const [branches, defaultBranchId] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        addressLine: true,
        area: true,
        city: true,
        latitude: true,
        longitude: true,
        phone: true,
        isDefault: true,
        acceptsOnlineOrders: true,
      },
    }),
    getDefaultBranchId(),
  ]);
  res.json({ branches, defaultBranchId });
});
