import { Router } from "express";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";
import { basePrisma } from "../../lib/prisma-base";

export const platformPlansRouter = Router();

platformPlansRouter.get("/", requirePlatformAuth, requirePlatformPermission("plans:read"), async (_req, res) => {
  const plans = await basePrisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({ plans });
});
