import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import { normalizeBranchCodeInput } from "../lib/branches/code";
import {
  applyStaffOnDeactivation,
  buildDeactivationCheck,
  countActiveBranches,
  type StaffDeactivationAction,
} from "../lib/branches/deactivation";
import { listAdminBranches, parseListRangeQuery } from "../lib/branches/list";
import { branchDataFromParsed, parseBranchCreateBody, validateBranchFields } from "../lib/branches/validate";
import { copyBranchSetup, type CopyFromOptions } from "../lib/branches/copy-from";

export const adminBranchesRouter = Router();

const ADMIN_ONLY = [Role.ADMIN] as Role[];

adminBranchesRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  const user = req.user!;
  const range = parseListRangeQuery(req.query.range);
  const includePerformance = user.role === Role.ADMIN;

  let branchIds: string[] | undefined;
  if (user.role === Role.MANAGER) {
    const memberships = await prisma.branchMember.findMany({
      where: { userId: user.id, branch: { isActive: true } },
      select: { branchId: true },
    });
    branchIds = memberships.map((m) => m.branchId);
    if (!branchIds.length) {
      return res.json({ branches: [], meta: { range, timezone: null, ms: 0 } });
    }
  }

  const result = await listAdminBranches({ range, includePerformance, branchIds });
  res.json(result);
});

adminBranchesRouter.post("/", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const parsed = parseBranchCreateBody(req.body as Record<string, unknown>);
  const errors = validateBranchFields(parsed);
  if (Object.keys(errors).length) return res.status(400).json({ error: "Validation failed.", errors });

  const body = req.body as Record<string, unknown>;
  const copyFrom = parseCopyFromBody(body.copyFrom);

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (parsed.isDefault) {
        await tx.branch.updateMany({ data: { isDefault: false } });
      }
      const data = branchDataFromParsed(parsed);
      const created = await tx.branch.create({
        data,
      });
      let copySummary = null;
      if (copyFrom) {
        copySummary = await copyBranchSetup(
          tx as typeof prisma,
          copyFrom.sourceBranchId,
          created.id,
          copyFrom.options
        );
      }
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId: created.id,
        action: AuditAction.BRANCH_CHANGED,
        entityType: "branch",
        entityId: created.id,
        after: { name: created.name, code: created.code, copyFrom: copySummary },
        ip: clientIp(req),
      });
      return { branch: created, copySummary };
    });
    res.status(201).json(result);
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 409;
    const message = err instanceof Error ? err.message : "Could not create branch.";
    if (status === 409) {
      return res.status(409).json({ error: "A branch with this code already exists.", code: "BRANCH_CODE_TAKEN" });
    }
    return res.status(status).json({ error: message });
  }
});

adminBranchesRouter.post("/:id/copy-from", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const target = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Branch not found." });
  const copyFrom = parseCopyFromBody(req.body);
  if (!copyFrom) {
    return res.status(400).json({ error: "sourceBranchId and copy options are required." });
  }
  try {
    const copySummary = await prisma.$transaction((tx) =>
      copyBranchSetup(tx as typeof prisma, copyFrom.sourceBranchId, target.id, copyFrom.options)
    );
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: target.id,
      action: AuditAction.BRANCH_CHANGED,
      entityType: "branch",
      entityId: target.id,
      after: { copyFrom: copySummary },
      ip: clientIp(req),
    });
    res.json({ copySummary });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
    return res.status(status).json({ error: err instanceof Error ? err.message : "Copy failed." });
  }
});

adminBranchesRouter.patch("/:id", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Branch not found." });

  const body = req.body as Record<string, unknown>;
  const parsed = parseBranchCreateBody({ ...existing, ...body, name: body.name ?? existing.name });
  const errors = validateBranchFields(parsed, { requireName: true });
  if (Object.keys(errors).length) return res.status(400).json({ error: "Validation failed.", errors });

  const hasOrders = await prisma.order.findFirst({ where: { branchId: existing.id }, select: { id: true } });
  const codeLocked = Boolean(hasOrders);
  if (body.code !== undefined && codeLocked) {
    const next = normalizeBranchCodeInput(String(body.code));
    if (next !== existing.code) {
      return res.status(400).json({
        error: "Branch code cannot be changed after orders exist for this branch.",
        code: "BRANCH_CODE_LOCKED",
      });
    }
  }

  if (parsed.managerUserId) {
    const member = await prisma.branchMember.findFirst({
      where: { branchId: existing.id, userId: parsed.managerUserId },
      select: { id: true },
    });
    if (!member) {
      return res.status(400).json({ error: "Manager must be a staff member of this branch." });
    }
  }

  if (body.isDefault === true) {
    await prisma.branch.updateMany({ data: { isDefault: false } });
  }

  if (body.isActive === false) {
    const check = await buildDeactivationCheck(existing.id);
    if (!check.canDeactivate) {
      return res.status(409).json({
        error: "Cannot deactivate this branch.",
        code: "DEACTIVATION_BLOCKED",
        ...check,
      });
    }
  }
  if (body.isActive === false && existing.isDefault) {
    return res.status(400).json({
      error: "Cannot deactivate the default branch. Set another default first.",
      code: "DEFAULT_BRANCH",
    });
  }
  if (body.isActive === false && existing.isActive) {
    const other = await countActiveBranches(existing.id);
    if (other === 0) {
      return res.status(400).json({
        error: "At least one branch must stay active.",
        code: "LAST_ACTIVE_BRANCH",
      });
    }
  }

  try {
    const branch = await prisma.$transaction(async (tx) => {
      const updated = await tx.branch.update({
        where: { id: existing.id },
        data: {
          name: parsed.name,
          ...(body.code !== undefined && !codeLocked ? { code: parsed.code } : {}),
          address: parsed.address,
          addressLine: parsed.addressLine,
          area: parsed.area,
          city: parsed.city,
          phone: parsed.phone,
          email: parsed.email,
          latitude:
            body.latitude !== undefined
              ? parsed.latitude === "" || parsed.latitude === null
                ? null
                : Number(parsed.latitude)
              : undefined,
          longitude:
            body.longitude !== undefined
              ? parsed.longitude === "" || parsed.longitude === null
                ? null
                : Number(parsed.longitude)
              : undefined,
          managerUserId: body.managerUserId !== undefined ? parsed.managerUserId : undefined,
          acceptsOnlineOrders:
            body.acceptsOnlineOrders !== undefined ? Boolean(body.acceptsOnlineOrders) : undefined,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
          deactivatedAt:
            body.isActive === false ? new Date() : body.isActive === true ? null : undefined,
          isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : undefined,
          sortOrder: body.sortOrder !== undefined ? parsed.sortOrder : undefined,
        },
      });
      await writeAudit(tx, {
        actorId: req.user!.id,
        actorRole: req.user!.role,
        branchId: updated.id,
        action: AuditAction.BRANCH_CHANGED,
        entityType: "branch",
        entityId: updated.id,
        before: { name: existing.name, code: existing.code, isDefault: existing.isDefault },
        after: { name: updated.name, code: updated.code, isDefault: updated.isDefault },
        ip: clientIp(req),
      });
      return updated;
    });
    res.json({ branch });
  } catch {
    res.status(409).json({ error: "Could not update branch.", code: "BRANCH_UPDATE_FAILED" });
  }
});

adminBranchesRouter.post("/:id/make-default", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Branch not found." });
  if (!existing.isActive) {
    return res.status(400).json({ error: "Inactive branches cannot be default.", code: "BRANCH_INACTIVE" });
  }

  const branch = await prisma.$transaction(async (tx) => {
    await tx.branch.updateMany({ data: { isDefault: false } });
    const updated = await tx.branch.update({
      where: { id: existing.id },
      data: { isDefault: true },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: updated.id,
      action: AuditAction.BRANCH_CHANGED,
      entityType: "branch",
      entityId: updated.id,
      before: { isDefault: existing.isDefault },
      after: { isDefault: true },
      ip: clientIp(req),
    });
    return updated;
  });
  res.json({ branch });
});

adminBranchesRouter.patch("/:id/online-ordering", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Branch not found." });
  const enabled = Boolean((req.body as { enabled?: boolean }).enabled);
  const reason = String((req.body as { reason?: string }).reason ?? "").trim();
  if (!enabled && !reason) {
    return res.status(400).json({ error: "A reason is required when turning off online ordering." });
  }

  const branch = await prisma.$transaction(async (tx) => {
    const updated = await tx.branch.update({
      where: { id: existing.id },
      data: { acceptsOnlineOrders: enabled },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: updated.id,
      action: AuditAction.BRANCH_CHANGED,
      entityType: "branch",
      entityId: updated.id,
      before: { acceptsOnlineOrders: existing.acceptsOnlineOrders },
      after: { acceptsOnlineOrders: enabled },
      reason: reason || undefined,
      ip: clientIp(req),
    });
    return updated;
  });
  res.json({ branch });
});

adminBranchesRouter.get("/:id/deactivation-check", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const check = await buildDeactivationCheck(req.params.id);
  res.json(check);
});

adminBranchesRouter.post("/:id/deactivate", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Branch not found." });

  const check = await buildDeactivationCheck(existing.id);
  if (!check.canDeactivate) {
    return res.status(409).json({
      error: "Cannot deactivate this branch yet.",
      code: "DEACTIVATION_BLOCKED",
      ...check,
    });
  }

  const staffAction = parseStaffAction(req.body);
  if (check.staffAssigned > 0 && !staffAction) {
    return res.status(400).json({
      error: "Choose how to handle assigned staff before deactivating.",
      code: "STAFF_ACTION_REQUIRED",
      staffAssigned: check.staffAssigned,
    });
  }

  const branch = await prisma.$transaction(async (tx) => {
    if (staffAction) {
      await applyStaffOnDeactivation(existing.id, staffAction);
    }
    const updated = await tx.branch.update({
      where: { id: existing.id },
      data: { isActive: false, deactivatedAt: new Date(), managerUserId: null },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: updated.id,
      action: AuditAction.BRANCH_CHANGED,
      entityType: "branch",
      entityId: updated.id,
      before: { isActive: true },
      after: { isActive: false, staffAction },
      ip: clientIp(req),
    });
    return updated;
  });
  res.json({ branch });
});

adminBranchesRouter.post("/:id/reactivate", requireAuth, requireRole(...ADMIN_ONLY), async (req, res) => {
  const existing = await prisma.branch.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Branch not found." });

  const branch = await prisma.$transaction(async (tx) => {
    const updated = await tx.branch.update({
      where: { id: existing.id },
      data: { isActive: true, deactivatedAt: null },
    });
    await writeAudit(tx, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      branchId: updated.id,
      action: AuditAction.BRANCH_CHANGED,
      entityType: "branch",
      entityId: updated.id,
      before: { isActive: false },
      after: { isActive: true },
      ip: clientIp(req),
    });
    return updated;
  });
  res.json({ branch });
});

function parseCopyFromBody(raw: unknown): { sourceBranchId: string; options: CopyFromOptions } | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as { sourceBranchId?: string; options?: CopyFromOptions };
  const sourceBranchId = String(b.sourceBranchId || "").trim();
  if (!sourceBranchId) return null;
  const options = b.options || {};
  const any =
    options.menuAvailability ||
    options.printStations ||
    options.tables ||
    options.deliveryAreas ||
    options.openingHours;
  if (!any) return null;
  return { sourceBranchId, options };
}

function parseStaffAction(body: unknown): StaffDeactivationAction | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { staffAction?: string; targetBranchId?: string };
  if (b.staffAction === "reassign" && b.targetBranchId) {
    return { mode: "reassign", targetBranchId: String(b.targetBranchId) };
  }
  if (b.staffAction === "revoke") return { mode: "revoke" };
  return null;
}
