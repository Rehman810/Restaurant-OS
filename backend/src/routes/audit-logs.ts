import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { buildAuditLogWhere } from "../lib/audit-log-query";

export const auditLogsRouter = Router();

function parseDate(v: unknown) {
  if (!v || typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

auditLogsRouter.get("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const actorId = typeof req.query.actorId === "string" ? req.query.actorId.trim() : "";
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType.trim() : "";
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId.trim() : "";
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const branchFilter = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";

  const where = buildAuditLogWhere(scope, {
    action,
    actorId,
    entityType,
    entityId,
    branchId: branchFilter,
    from,
    to,
  });

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs: rows, total, limit, offset });
});

auditLogsRouter.get("/export.csv", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const where = buildAuditLogWhere(scope, { action, from, to });

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { actor: { select: { email: true, name: true } } },
  });

  const header = "createdAt,action,entityType,entityId,actorEmail,actorRole,branchId,reason,ip\n";
  const lines = rows.map((r) => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      r.createdAt.toISOString(),
      esc(r.action),
      esc(r.entityType),
      esc(r.entityId),
      esc(r.actor?.email || ""),
      esc(r.actorRole || ""),
      esc(r.branchId || ""),
      esc(r.reason || ""),
      esc(r.ip || ""),
    ].join(",");
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
  res.send(header + lines.join("\n"));
});
