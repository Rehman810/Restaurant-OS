import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { getOnboardingStatus } from "../lib/onboarding";

export const adminOnboardingRouter = Router();

adminOnboardingRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (_req, res) => {
  res.json(await getOnboardingStatus());
});
