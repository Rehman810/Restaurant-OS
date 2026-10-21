import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { ADMIN_LIKE } from "../lib/roles";
import { handleDailySummaryGet } from "./daily-summary-handler";
import { sendDailyCloseoutTestEmail } from "../lib/reports/daily-closeout-email";
import { handleDailySummaryBlockers } from "./daily-summary-blockers";

export const dailySummaryRouter = Router();

dailySummaryRouter.get(
  "/blockers",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  handleDailySummaryBlockers
);

dailySummaryRouter.get(
  "/",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  handleDailySummaryGet
);

dailySummaryRouter.get(
  "/export.csv",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  handleDailySummaryGet
);

dailySummaryRouter.post(
  "/email/test",
  requireAuth,
  requireRole(...ADMIN_LIKE, Role.MANAGER),
  async (_req, res) => {
    try {
      const result = await sendDailyCloseoutTestEmail();
      if (!result.sent) {
        return res.status(400).json({ error: `Email not sent: ${result.reason}` });
      }
      return res.json({ ok: true, recipients: result.recipients });
    } catch (e) {
      console.error("[daily-closeout email test]", e);
      return res.status(500).json({ error: "Failed to send test email" });
    }
  }
);
