import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ADMIN_LIKE } from "../lib/roles";
import { requireAuth, requireRole } from "../middleware/auth";
import { branchScopeError, resolveBranchScope } from "../lib/branch-scope";
import { buildAuditLogWhere, parseAuditListQuery } from "../lib/audit-log-query";
import { enrichAuditLogs } from "../lib/audit-enrich";
import { auditActionsByCategory, AUDIT_ENTITY_TYPES } from "../lib/audit-actions";
import { getStoreSettings } from "../lib/settings-data";
import { maskPiiInText } from "../lib/audit-pii";
import { requireEntitlement } from "../lib/platform/entitlement-middleware";

export const auditLogsRouter = Router();
auditLogsRouter.use(requireEntitlement("auditLog"));

function formatLocalTime(iso: Date, timezone: string) {
  return iso.toLocaleString("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

auditLogsRouter.get("/filters", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }
  const branchWhere = scope.allBranches ? {} : { branchId: scope.branchId };
  const actors = await prisma.auditLog.findMany({
    where: { ...branchWhere, actorId: { not: null } },
    distinct: ["actorId"],
    take: 80,
    orderBy: { createdAt: "desc" },
    select: {
      actorId: true,
      actor: { select: { id: true, name: true, role: true } },
    },
  });
  res.json({
    categories: Object.keys(auditActionsByCategory()),
    actionsByCategory: auditActionsByCategory(),
    entityTypes: AUDIT_ENTITY_TYPES,
    actors: actors
      .filter((a) => a.actor)
      .map((a) => ({
        id: a.actorId!,
        name: a.actor!.name,
        role: a.actor!.role,
      })),
  });
});

auditLogsRouter.get("/", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const { limit, offset, filters } = parseAuditListQuery(req.query as Record<string, unknown>);
  const where = buildAuditLogWhere(scope, filters);

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

  const settings = await getStoreSettings();
  const logs = await enrichAuditLogs(rows, true);
  res.json({
    logs,
    total,
    limit,
    offset,
    timezone: settings.timezone || "Asia/Karachi",
  });
});

auditLogsRouter.get("/export.csv", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const { filters } = parseAuditListQuery({ ...req.query, limit: "5000", offset: "0" });
  const where = buildAuditLogWhere(scope, filters);
  const settings = await getStoreSettings();
  const timezone = settings.timezone || "Asia/Karachi";

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });

  const enriched = await enrichAuditLogs(rows, true);
  const header =
    "createdAtUtc,createdAtLocal,actionLabel,actionCode,category,entityType,entityLabel,entityId,actorName,actorRole,branch,summary,before,after,reason\n";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = enriched.map((r) => {
    const raw = rows.find((x) => x.id === r.id)!;
    return [
      raw.createdAt.toISOString(),
      esc(formatLocalTime(raw.createdAt, timezone)),
      esc(r.actionLabel),
      esc(r.action),
      esc(r.category),
      esc(r.entityType),
      esc(r.entityLabel),
      esc(r.entityId),
      esc(maskPiiInText(r.actor.name)),
      esc(r.actor.role || ""),
      esc(r.branch?.name || ""),
      esc(r.summary),
      esc(JSON.stringify(r.before ?? "")),
      esc(JSON.stringify(r.after ?? "")),
      esc(r.reason ? maskPiiInText(r.reason) : ""),
    ].join(",");
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
  res.send(header + lines.join("\n"));
});
