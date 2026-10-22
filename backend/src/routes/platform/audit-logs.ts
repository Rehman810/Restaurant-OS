import { Router } from "express";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";

export const platformAuditRouter = Router();

platformAuditRouter.get("/", requirePlatformAuth, requirePlatformPermission("audit:read"), async (req, res) => {
  const subjectTenantId = String(req.query.tenantId || "").trim();
  const action = String(req.query.action || "").trim();
  const take = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = await basePrisma.platformAuditLog.findMany({
    where: {
      ...(subjectTenantId ? { subjectTenantId } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  const tenantIds = [...new Set(rows.map((r) => r.subjectTenantId).filter(Boolean))] as string[];
  const tenants =
    tenantIds.length > 0
      ? await basePrisma.restaurant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, slug: true, displayName: true },
        })
      : [];
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  res.json({
    logs: rows.map((row) => ({
      ...row,
      tenant: row.subjectTenantId ? tenantById.get(row.subjectTenantId) ?? null : null,
    })),
  });
});
