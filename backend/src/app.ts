import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { riderRouter } from "./routes/rider";
import { adminRouter } from "./routes/admin";
import { adminBranchesRouter } from "./routes/admin-branches";
import { adminOrdersRouter } from "./routes/admin-orders";
import { adminTrackingRouter } from "./routes/admin-tracking";
import { adminMenuRouter } from "./routes/admin-menu";
import { invoicesRouter } from "./routes/invoices";
import { uploadRouter } from "./routes/upload";
import { categoriesRouter } from "./routes/categories";
import { dealsRouter } from "./routes/deals";
import { deliveryAreasRouter } from "./routes/delivery-areas";
import { adminAreasRouter } from "./routes/admin-areas";
import { settingsRouter } from "./routes/settings";
import { staffRouter } from "./routes/staff";
import { staffNotificationsRouter } from "./routes/staff-notifications";
import { blocklistRouter } from "./routes/blocklist";
import { posRouter } from "./routes/pos";
import { branchesRouter } from "./routes/branches";
import { dineInPublicRouter, dineInRouter } from "./routes/dine-in";
import { inventoryRouter } from "./routes/inventory";
import { auditLogsRouter } from "./routes/audit-logs";
import { approvalRouter } from "./routes/approval";
import { shiftsRouter } from "./routes/shifts";
import { riderCashRouter } from "./routes/rider-cash";
import { printStationsRouter } from "./routes/print-stations";
import { kotRouter } from "./routes/kot";
import { kitchenRouter } from "./routes/kitchen";
import { couponsAdminRouter, couponsPublicRouter } from "./routes/coupons";
import { reportsRouter } from "./routes/reports";
import { dailySummaryRouter } from "./routes/daily-summary";
import { resolveRestaurantIdFromRequest, runWithRestaurant } from "./lib/prisma";
import { serveUpload } from "./lib/uploads";
import {
  allowedOrigins,
  errorHandler,
  globalLimiter,
  notFound,
  securityHeaders,
} from "./middleware/security";
import { csrfProtection } from "./middleware/csrf";
import { adminBillingRouter } from "./routes/admin-billing";
import { adminOnboardingRouter } from "./routes/admin-onboarding";
import { platformRouter } from "./routes/platform";
import { platformCsrfProtection } from "./middleware/platform-csrf";
import { loadTenantAccess, tenantLifecycleMiddleware } from "./middleware/tenant-lifecycle";
import { maintenanceMiddleware } from "./middleware/maintenance";
import { adminAnnouncementsRouter } from "./routes/admin-announcements";
import { adminSupportAccessRouter } from "./routes/admin-support-access";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(async (req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/platform")) return next();
    try {
      const id = await resolveRestaurantIdFromRequest(req);
      if (!id) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      const access = await loadTenantAccess(id);
      if (!access?.resolvable) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      runWithRestaurant(id, () => {
        req.tenantAccess = access;
        next();
      });
    } catch (err) {
      next(err);
    }
  });
  app.use(securityHeaders());
  app.use(cors({ origin: allowedOrigins(), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(platformCsrfProtection);
  app.use(csrfProtection);
  app.use(globalLimiter);
  app.use(maintenanceMiddleware);
  app.use(tenantLifecycleMiddleware);
  app.use("/uploads", serveUpload);

  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      apiVersion: 2,
      features: {
        dashboardSummary: true,
        adminOrdersDispatch: true,
        adminTracking: true,
      },
    })
  );
  app.use("/upload", uploadRouter);
  app.use("/platform", platformRouter);
  app.use("/auth", authRouter);
  app.use("/menu", menuRouter);
  app.use("/categories", categoriesRouter);
  app.use("/deals", dealsRouter);
  app.use("/delivery-areas", deliveryAreasRouter);
  app.use("/admin/areas", adminAreasRouter);
  app.use("/settings", settingsRouter);
  app.use("/coupons", couponsPublicRouter);
  app.use("/admin/coupons", couponsAdminRouter);
  app.use("/branches", branchesRouter);
  app.use("/dine-in", dineInPublicRouter);
  app.use("/admin/dine-in", dineInRouter);
  app.use("/admin/inventory", inventoryRouter);
  app.use("/orders", ordersRouter);
  app.use("/pos", posRouter);
  app.use("/rider", riderRouter);
  app.use("/admin/staff", staffRouter);
  app.use("/admin/notifications", staffNotificationsRouter);
  app.use("/admin/blocks", blocklistRouter);
  app.use("/admin/audit-logs", auditLogsRouter);
  app.use("/admin/approval", approvalRouter);
  app.use("/admin/shifts", shiftsRouter);
  app.use("/admin/rider-cash", riderCashRouter);
  app.use("/admin/print-stations", printStationsRouter);
  app.use("/admin/kot", kotRouter);
  app.use("/kitchen", kitchenRouter);
  app.use("/admin/reports", reportsRouter);
  app.use("/admin/daily-summary", dailySummaryRouter);
  app.use("/admin/orders", adminOrdersRouter);
  app.use("/admin/tracking", adminTrackingRouter);
  app.use("/admin/menu", adminMenuRouter);
  app.use("/admin/branches", adminBranchesRouter);
  app.use("/admin/billing", adminBillingRouter);
  app.use("/admin/announcements", adminAnnouncementsRouter);
  app.use("/admin/support-access", adminSupportAccessRouter);
  app.use("/admin/onboarding", adminOnboardingRouter);
  app.use("/admin", adminRouter);
  app.use("/invoices", invoicesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
