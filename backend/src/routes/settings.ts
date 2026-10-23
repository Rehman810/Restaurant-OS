import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { fetchGoogleReviews } from "../lib/google-reviews";
import { getPublicStorePayload, getStoreSettings } from "../lib/settings-data";
import { firstSettingsErrorMessage, normalizeSettingsPatch, validateSettingsInput } from "../lib/settings-validate";
import {
  buildStoreSettingsUpdateData,
  patchStoreSettingsSection,
  adminSettingsWithVersion,
  settingsWithVersion,
} from "../lib/settings-update";
import { assertSettingsSectionAccess, SETTINGS_SECTION_IDS } from "../lib/settings-sections";
import { pickSectionPatch, STOREFRONT_SETTINGS_SECTIONS } from "../lib/settings-section-fields";
import { requireAuth, requireRole } from "../middleware/auth";
import { diffSettingsKeys, settingsSnapshotForAudit, writeAudit } from "../lib/audit";
import { AuditAction } from "../lib/audit-actions";
import { clientIp } from "../lib/client-ip";
import {
  listSettingsSectionsForRole,
  SETTINGS_SECTION_LABELS,
  type SettingsSectionId,
} from "../lib/settings-sections";
import { checkDangerousSettingsConfirm } from "../lib/settings-save-guard";
import { entryIsRestorable, sectionForAuditKey, settingsAuditMeta } from "../lib/settings-audit";
import { NOTIFICATION_EMAIL_ROWS, NOTIFY_ROLE_COLUMNS } from "../lib/notification-email-matrix";
import { CONTACT_FIELD_USAGE, CONTACT_NOT_IN_THIS_SECTION } from "../lib/contact-sot";
import { getIntegrationsStatus } from "../lib/integrations-status";

export const settingsRouter = Router();

async function adminSettingsResponse(settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  return adminSettingsWithVersion(settings, async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? null;
  });
}

settingsRouter.get("/sections", requireAuth, async (req, res) => {
  const role = req.user!.role;
  res.json({ sections: listSettingsSectionsForRole(role) });
});

settingsRouter.get("/notifications/email-matrix", requireAuth, requireRole(Role.ADMIN), (_req, res) => {
  res.json({ rows: NOTIFICATION_EMAIL_ROWS, columns: NOTIFY_ROLE_COLUMNS });
});

settingsRouter.get("/contact/usage", requireAuth, requireRole(Role.ADMIN), (_req, res) => {
  res.json({ fields: CONTACT_FIELD_USAGE, editedElsewhere: CONTACT_NOT_IN_THIS_SECTION });
});

settingsRouter.get("/integrations/status", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const settings = await getStoreSettings();
  res.json(getIntegrationsStatus(settings));
});

settingsRouter.post("/integrations/smtp-test", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const settings = await getStoreSettings();
  const to = String((req.body as { to?: string }).to || req.user!.email || "").trim();
  if (!to.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address for the test." });
  }
  const { resolveSmtpFromSettings } = await import("../lib/smtp-config");
  const { sendEmailWithConfig } = await import("../lib/email");
  const config = resolveSmtpFromSettings(settings);
  if (!config) {
    return res.status(400).json({ error: "SMTP is not configured. Save restaurant SMTP or set server .env SMTP." });
  }
  const ok = await sendEmailWithConfig(
    config,
    to,
    `SMTP test — ${settings.storeName || "Restaurant"}`,
    `<p>If you received this, outbound email is working for <strong>${settings.storeName || "your restaurant"}</strong>.</p>`,
    `SMTP test for ${settings.storeName || "your restaurant"}.`,
    settings.storeName
  );
  if (!ok) return res.status(502).json({ error: "SMTP login or send failed. Check host, port, and password." });
  res.json({ ok: true, to });
});

settingsRouter.get("/public", async (_req, res) => {
  res.json(await getPublicStorePayload());
});

settingsRouter.get("/reviews", async (_req, res) => {
  const settings = await getStoreSettings();
  const google = await fetchGoogleReviews(settings.googlePlaceId);
  res.json(google || { rating: 0, total: 0, reviews: [], source: "fallback" });
});

settingsRouter.get("/", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const settings = await getStoreSettings();
  const [banners, testimonials] = await Promise.all([
    prisma.promoBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  res.json({
    settings: await adminSettingsResponse(settings),
    banners,
    testimonials,
  });
});

settingsRouter.patch("/sections/:sectionId", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const sectionId = req.params.sectionId;
  if (!SETTINGS_SECTION_IDS.includes(sectionId as SettingsSectionId)) {
    return res.status(404).json({ code: "SECTION_NOT_FOUND", error: "Unknown settings section." });
  }
  assertSettingsSectionAccess(req.user!.role, sectionId);

  const body = req.body as Record<string, unknown>;
  const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return res.status(400).json({
      code: "VERSION_REQUIRED",
      error: "Include the current settings version when saving.",
    });
  }

  const current = await getStoreSettings();
  const currentRow = current as unknown as Record<string, unknown>;
  const patch = pickSectionPatch(sectionId as SettingsSectionId, body);
  if (sectionId === "hours-availability") {
    if (patch.forceClosed === true && !current.forceClosed) {
      patch.onlineClosedAt = new Date();
      patch.onlineClosedByUserId = req.user!.id;
    }
    if (patch.forceClosed === false && current.forceClosed) {
      patch.onlineClosedAt = null;
      patch.onlineClosedByUserId = null;
    }
  }
  const normalized = normalizeSettingsPatch(patch);
  const fieldErrors = validateSettingsInput(normalized);
  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({
      code: "VALIDATION_FAILED",
      error: firstSettingsErrorMessage(fieldErrors),
      fields: fieldErrors,
    });
  }
  const danger = checkDangerousSettingsConfirm(currentRow, normalized, body.confirm);
  if (!danger.ok) {
    return res.status(400).json({
      code: "CONFIRMATION_REQUIRED",
      error: "Confirm this change before saving.",
      dangerous: danger.dangerous,
      impacts: danger.impacts,
    });
  }

  const beforeSnap = settingsSnapshotForAudit(currentRow);
  const touchedKeys = Object.keys(normalized);

  const result = await patchStoreSettingsSection({
    sectionId: sectionId as SettingsSectionId,
    body: { ...body, ...patch },
    expectedVersion,
  });

  if (!result.ok) {
    return res.status(409).json({
      code: "SETTINGS_VERSION_CONFLICT",
      error: "Someone else changed these settings.",
      version: result.current.settingsVersion,
      settings: settingsWithVersion(result.current),
      diff: result.diff,
      affectsStorefront: STOREFRONT_SETTINGS_SECTIONS.includes(sectionId as SettingsSectionId),
    });
  }

  const updated = result.settings;
  const afterSnap = settingsSnapshotForAudit(updated as unknown as Record<string, unknown>);
  const { before, after } = diffSettingsKeys(beforeSnap, afterSnap, touchedKeys);
  const changedKeys = Object.keys(after);
  if (changedKeys.length > 0) {
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: "store_settings",
      entityId: updated.id,
      before,
      after,
      ip: clientIp(req),
      meta: settingsAuditMeta(
        sectionId as SettingsSectionId,
        changedKeys,
        SETTINGS_SECTION_LABELS[sectionId as SettingsSectionId]
      ),
    });
  }

  res.json({
    settings: await adminSettingsResponse(updated),
    affectsStorefront: STOREFRONT_SETTINGS_SECTIONS.includes(sectionId as SettingsSectionId),
  });
});

settingsRouter.get("/sections/:sectionId/history", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const sectionId = req.params.sectionId;
  if (!SETTINGS_SECTION_IDS.includes(sectionId as SettingsSectionId)) {
    return res.status(404).json({ code: "SECTION_NOT_FOUND", error: "Unknown settings section." });
  }
  const settings = await getStoreSettings();
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "store_settings", entityId: settings.id, action: AuditAction.SETTINGS_CHANGED },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { actor: { select: { name: true, email: true } } },
  });
  const entries = rows
    .filter((row) => (row.meta as { sectionId?: string } | null)?.sectionId === sectionId)
    .slice(0, 40)
    .map((row) => {
      const before = (row.before ?? {}) as Record<string, unknown>;
      const after = (row.after ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        createdAt: row.createdAt,
        actorName: row.actor?.name || row.actor?.email || "System",
        actorRole: row.actorRole,
        before,
        after,
        changedKeys: Object.keys(after),
        restorable: entryIsRestorable(before, after),
      };
    });
  res.json({ entries });
});

settingsRouter.post("/sections/:sectionId/restore", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const sectionId = req.params.sectionId as SettingsSectionId;
  if (!SETTINGS_SECTION_IDS.includes(sectionId)) {
    return res.status(404).json({ code: "SECTION_NOT_FOUND", error: "Unknown settings section." });
  }
  const { auditLogId, version } = req.body as { auditLogId?: string; version?: number };
  if (!auditLogId) {
    return res.status(400).json({ code: "AUDIT_ID_REQUIRED", error: "Choose a history entry to restore." });
  }
  const expectedVersion = Number(version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return res.status(400).json({ code: "VERSION_REQUIRED", error: "Include the current settings version." });
  }

  const settings = await getStoreSettings();
  const row = await prisma.auditLog.findFirst({
    where: { id: auditLogId, entityType: "store_settings", entityId: settings.id },
  });
  if (!row) return res.status(404).json({ code: "NOT_FOUND", error: "History entry not found." });
  if ((row.meta as { sectionId?: string } | null)?.sectionId !== sectionId) {
    return res.status(400).json({ code: "SECTION_MISMATCH", error: "That change belongs to another section." });
  }
  const before = (row.before ?? {}) as Record<string, unknown>;
  const after = (row.after ?? {}) as Record<string, unknown>;
  if (!entryIsRestorable(before, after)) {
    return res.status(400).json({
      code: "NOT_RESTORABLE",
      error: "This change cannot be restored automatically. Update the setting manually.",
    });
  }

  const restorePatch = pickSectionPatch(sectionId, before);
  const normalized = normalizeSettingsPatch(restorePatch);
  const danger = checkDangerousSettingsConfirm(
    settings as unknown as Record<string, unknown>,
    normalized,
    req.body.confirm
  );
  if (!danger.ok) {
    return res.status(400).json({
      code: "CONFIRMATION_REQUIRED",
      error: "Confirm before restoring this value.",
      dangerous: danger.dangerous,
      impacts: danger.impacts,
    });
  }

  const result = await patchStoreSettingsSection({
    sectionId,
    body: { ...normalized, version: expectedVersion },
    expectedVersion,
  });
  if (!result.ok) {
    return res.status(409).json({
      code: "SETTINGS_VERSION_CONFLICT",
      error: "Someone else changed these settings.",
      version: result.current.settingsVersion,
      settings: settingsWithVersion(result.current),
    });
  }

  const updated = result.settings;
  const beforeSnap = settingsSnapshotForAudit(settings as unknown as Record<string, unknown>);
  const afterSnap = settingsSnapshotForAudit(updated as unknown as Record<string, unknown>);
  const keys = Object.keys(normalized);
  const diff = diffSettingsKeys(beforeSnap, afterSnap, keys);
  if (Object.keys(diff.after).length > 0) {
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: "store_settings",
      entityId: updated.id,
      before: diff.before,
      after: diff.after,
      ip: clientIp(req),
      meta: settingsAuditMeta(sectionId, Object.keys(diff.after), SETTINGS_SECTION_LABELS[sectionId]),
      reason: "Restored from change history",
    });
  }

  res.json({ settings: settingsWithVersion(updated) });
});

settingsRouter.patch("/", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const normalized = normalizeSettingsPatch(body);
  const fieldErrors = validateSettingsInput(normalized);
  if (Object.keys(fieldErrors).length) {
    return res.status(400).json({
      code: "VALIDATION_FAILED",
      error: firstSettingsErrorMessage(fieldErrors),
      fields: fieldErrors,
    });
  }

  const current = await getStoreSettings();
  const expectedVersion = body.version !== undefined ? Number(body.version) : current.settingsVersion;
  if (body.version !== undefined && expectedVersion !== current.settingsVersion) {
    return res.status(409).json({
      code: "SETTINGS_VERSION_CONFLICT",
      error: "Someone else changed these settings.",
      version: current.settingsVersion,
      settings: settingsWithVersion(current),
    });
  }

  const currentRow = current as unknown as Record<string, unknown>;
  const patchBody = { ...normalized };
  delete patchBody.version;
  const danger = checkDangerousSettingsConfirm(currentRow, patchBody, body.confirm);
  if (!danger.ok) {
    return res.status(400).json({
      code: "CONFIRMATION_REQUIRED",
      error: "Confirm this change before saving.",
      dangerous: danger.dangerous,
      impacts: danger.impacts,
    });
  }

  const beforeSnap = settingsSnapshotForAudit(currentRow);
  const touchedKeys = Object.keys(patchBody);
  const settings = await prisma.$transaction(async (tx) => {
    const result = await tx.storeSettings.updateMany({
      where: { id: current.id, settingsVersion: expectedVersion },
      data: {
        ...buildStoreSettingsUpdateData(patchBody),
        settingsVersion: expectedVersion + 1,
      },
    });
    if (result.count === 0) {
      throw Object.assign(new Error("conflict"), { code: "SETTINGS_VERSION_CONFLICT" });
    }
    const updated = await tx.storeSettings.findUniqueOrThrow({ where: { id: current.id } });
    return updated;
  }).catch(async (err) => {
    if (err?.code === "SETTINGS_VERSION_CONFLICT" || err?.message === "conflict") {
      const latest = await getStoreSettings();
      return { conflict: latest };
    }
    throw err;
  });

  if (settings && "conflict" in settings) {
    const latest = settings.conflict as Awaited<ReturnType<typeof getStoreSettings>>;
    return res.status(409).json({
      code: "SETTINGS_VERSION_CONFLICT",
      error: "Someone else changed these settings.",
      version: latest.settingsVersion,
      settings: settingsWithVersion(latest),
    });
  }

  const updated = settings as Awaited<ReturnType<typeof getStoreSettings>>;
  const afterSnap = settingsSnapshotForAudit(updated as unknown as Record<string, unknown>);
  const { before, after } = diffSettingsKeys(beforeSnap, afterSnap, touchedKeys);
  const changedKeys = Object.keys(after);
  if (changedKeys.length > 0) {
    const sectionId = sectionForAuditKey(changedKeys[0]) ?? "branding-theme";
    await writeAudit(prisma, {
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: AuditAction.SETTINGS_CHANGED,
      entityType: "store_settings",
      entityId: updated.id,
      before,
      after,
      ip: clientIp(req),
      meta: settingsAuditMeta(sectionId as SettingsSectionId, changedKeys),
    });
  }
  res.json({ settings: settingsWithVersion(updated) });
});

settingsRouter.post("/banners", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { title, imageUrl, linkUrl, sortOrder, isActive } = req.body as {
    title?: string;
    imageUrl?: string;
    linkUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!imageUrl) return res.status(400).json({ error: "Banner image is required." });
  const min = await prisma.promoBanner.aggregate({ _min: { sortOrder: true } });
  const banner = await prisma.promoBanner.create({
    data: {
      title: title || "",
      imageUrl,
      linkUrl: linkUrl || "",
      sortOrder: sortOrder ?? (min._min.sortOrder ?? 1) - 1,
      isActive: isActive ?? true,
    },
  });
  res.status(201).json(banner);
});

settingsRouter.patch("/banners/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const existing = await prisma.promoBanner.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Banner not found." });
  const body = req.body as Record<string, unknown>;
  const banner = await prisma.promoBanner.update({
    where: { id: req.params.id },
    data: {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: String(body.imageUrl) } : {}),
      ...(body.linkUrl !== undefined ? { linkUrl: String(body.linkUrl) } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });
  res.json(banner);
});

settingsRouter.delete("/banners/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  try {
    await prisma.promoBanner.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Banner not found." });
  }
});

settingsRouter.post("/testimonials", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const { name, text, area, rating } = req.body as {
    name?: string;
    text?: string;
    area?: string;
    rating?: number;
  };
  if (!name?.trim() || !text?.trim()) {
    return res.status(400).json({ error: "Name and review text are required." });
  }
  const row = await prisma.testimonial.create({
    data: {
      name: name.trim(),
      text: text.trim(),
      area: area?.trim() || "",
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    },
  });
  res.status(201).json(row);
});

settingsRouter.delete("/testimonials/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  try {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Testimonial not found." });
  }
});
