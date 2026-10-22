import { Router } from "express";
import { platformAuthRouter } from "./auth";
import { platformTenantsRouter } from "./tenants";
import { platformPlansRouter } from "./plans";
import { platformInvoicesRouter } from "./invoices";
import { platformAuditRouter } from "./audit-logs";
import { platformOverviewRouter } from "./overview";
import { platformAnnouncementsRouter } from "./announcements";
import { platformSettingsRouter } from "./settings";
import { platformHealthRouter } from "./health";

export const platformRouter = Router();

platformRouter.use("/auth", platformAuthRouter);
platformRouter.use("/overview", platformOverviewRouter);
platformRouter.use("/announcements", platformAnnouncementsRouter);
platformRouter.use("/settings", platformSettingsRouter);
platformRouter.use("/health", platformHealthRouter);
platformRouter.use("/tenants", platformTenantsRouter);
platformRouter.use("/plans", platformPlansRouter);
platformRouter.use("/invoices", platformInvoicesRouter);
platformRouter.use("/audit-logs", platformAuditRouter);
