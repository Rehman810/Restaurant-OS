import { Router } from "express";
import { Prisma } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base";
import { requirePlatformAuth, requirePlatformPermission } from "../../middleware/platform-auth";

export const platformAuditRouter = Router();

function buildAuditWhere(req: import("express").Request): Prisma.PlatformAuditLogWhereInput {
  const subjectTenantId = String(req.query.tenantId || "").trim();
  const action = String(req.query.action || "").trim();
  const actorId = String(req.query.actorId || "").trim();
  const actorEmail = String(req.query.actorEmail || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  return {
    ...(subjectTenantId ? { subjectTenantId } : {}),
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    ...(actorId ? { actorId } : {}),
    ...(actorEmail ? { actorEmail: { contains: actorEmail, mode: "insensitive" } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
}

platformAuditRouter.get("/export.csv", requirePlatformAuth, requirePlatformPermission("audit:read"), async (req, res) => {
  const where = buildAuditWhere(req);
  const rows = await basePrisma.platformAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const lines = ["created_at,actor_email,action,entity_type,entity_id,tenant_id,before,after"];
  for (const row of rows) {
    lines.push(
      [
        row.createdAt.toISOString(),
        row.actorEmail,
        row.action,
        row.entityType,
        row.entityId,
        row.subjectTenantId || "",
        JSON.stringify(row.before ?? null),
        JSON.stringify(row.after ?? null),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="platform-audit.csv"');
  res.send(lines.join("\n"));
});

platformAuditRouter.get("/", requirePlatformAuth, requirePlatformPermission("audit:read"), async (req, res) => {
  const where = buildAuditWhere(req);
  const take = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = await basePrisma.platformAuditLog.findMany({
    where,
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
