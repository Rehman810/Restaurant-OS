import { NextFunction, Request, Response } from "express";
import { basePrisma } from "../lib/prisma-base";
import { lifecycleGate, tenantAccessForStatus, type TenantAccess } from "../lib/platform/tenant-lifecycle";
import { TenantStatus } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      tenantAccess?: TenantAccess;
    }
  }
}

const SKIP_PREFIXES = ["/health", "/platform", "/uploads"];

export async function loadTenantAccess(restaurantId: string): Promise<TenantAccess | null> {
  const row = await basePrisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { status: true, statusReason: true },
  });
  if (!row) return null;
  return tenantAccessForStatus(row.status, row.statusReason);
}

export function tenantLifecycleMiddleware(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
    return next();
  }
  if (req.supportAccess) return next();
  const access = req.tenantAccess;
  if (!access) return next();
  const gate = lifecycleGate(access, req.method, req.path);
  if (gate.blocked) {
    return res.status(gate.status).json({ error: gate.error, code: gate.code });
  }
  next();
}

export function isRestaurantResolvableStatus(status: TenantStatus) {
  return status !== TenantStatus.ARCHIVED;
}
