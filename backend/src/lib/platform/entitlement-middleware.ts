import { NextFunction, Request, Response } from "express";
import { assertEntitlement, EntitlementError, type PlanEntitlements } from "./entitlements";

export function requireEntitlement(feature: keyof PlanEntitlements) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await assertEntitlement(feature);
      next();
    } catch (err) {
      if (err instanceof EntitlementError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  };
}
