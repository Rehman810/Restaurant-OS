import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { basePrisma } from "../lib/prisma-base";
import { getRestaurantId } from "../lib/restaurant-context";

export const adminSupportAccessRouter = Router();

adminSupportAccessRouter.get(
  "/history",
  requireAuth,
  requireRole(Role.ADMIN),
  async (_req, res) => {
    const restaurantId = getRestaurantId();
    const sessions = await basePrisma.tenantSupportSession.findMany({
      where: { subjectRestaurantId: restaurantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        platformUser: { select: { name: true, email: true } },
      },
    });
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        startedAt: s.createdAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        operatorName: s.platformUser.name,
        operatorEmail: s.platformUser.email,
      })),
    });
  }
);
