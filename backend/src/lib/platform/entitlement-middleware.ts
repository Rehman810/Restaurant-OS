import { NextFunction, Request, Response } from "express";
import { accessLevelForHttpMethod } from "./module-access";
import { assertModuleAccess, EntitlementError, type PlanEntitlements } from "./entitlements";
import type { PlanModuleId } from "./plan-modules";

export function requireModulePlan(module: PlanModuleId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const level = accessLevelForHttpMethod(req.method);
      await assertModuleAccess(module, level);
      next();
    } catch (err) {
      if (err instanceof EntitlementError) {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  };
}

/** @deprecated Use requireModulePlan — kept for existing imports; enforces read/edit/delete by HTTP method. */
export function requireEntitlement(feature: keyof PlanEntitlements) {
  return requireModulePlan(feature as PlanModuleId);
}
