import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { getVapidPublicKey, removeStaffPushSubscription, upsertStaffPushSubscription } from "../lib/web-push";

const STAFF_PUSH_ROLES: Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.CHEF,
  Role.CASHIER,
  Role.WAITER,
  Role.RIDER,
];

export const staffNotificationsRouter = Router();

staffNotificationsRouter.get("/push/vapid-public", requireAuth, (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return res.status(503).json({ error: "Push notifications are not configured." });
  res.json({ publicKey });
});

staffNotificationsRouter.post("/push-subscribe", requireAuth, async (req, res) => {
  if (!STAFF_PUSH_ROLES.includes(req.user!.role)) {
    return res.status(403).json({ error: "Not allowed." });
  }
  const body = req.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }
  try {
    await upsertStaffPushSubscription({
      userId: req.user!.id,
      endpoint,
      p256dh,
      auth,
    });
    res.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    res.status(status).json({ error: err instanceof Error ? err.message : "Subscribe failed." });
  }
});

staffNotificationsRouter.post("/push-unsubscribe", requireAuth, async (req, res) => {
  const endpoint = String((req.body as { endpoint?: string }).endpoint ?? "").trim();
  if (!endpoint) return res.status(400).json({ error: "endpoint required" });
  await removeStaffPushSubscription(req.user!.id, endpoint);
  res.json({ ok: true });
});
