import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { riderRouter } from "./routes/rider";
import { adminRouter } from "./routes/admin";
import { invoicesRouter } from "./routes/invoices";
import { uploadRouter } from "./routes/upload";
import { categoriesRouter } from "./routes/categories";
import { dealsRouter } from "./routes/deals";
import { deliveryAreasRouter } from "./routes/delivery-areas";
import { settingsRouter } from "./routes/settings";
import { staffRouter } from "./routes/staff";
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
import { couponsAdminRouter, couponsPublicRouter } from "./routes/coupons";
import { reportsRouter } from "./routes/reports";
import { UPLOAD_DIR } from "./lib/uploads";
import { resolveRestaurantId, runWithRestaurant } from "./lib/prisma";
import {
  allowedOrigins,
  errorHandler,
  globalLimiter,
  notFound,
  securityHeaders,
} from "./middleware/security";
import { csrfProtection } from "./middleware/csrf";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(async (req, _res, next) => {
    try {
      const id = await resolveRestaurantId(req.hostname);
      runWithRestaurant(id, () => next());
    } catch (err) {
      next(err);
    }
  });
  app.use(securityHeaders());
  app.use(cors({ origin: allowedOrigins(), credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(csrfProtection);
  app.use(globalLimiter);
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
      },
    })
  );

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/upload", uploadRouter);
  app.use("/auth", authRouter);
  app.use("/menu", menuRouter);
  app.use("/categories", categoriesRouter);
  app.use("/deals", dealsRouter);
  app.use("/delivery-areas", deliveryAreasRouter);
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
  app.use("/admin/blocks", blocklistRouter);
  app.use("/admin/audit-logs", auditLogsRouter);
  app.use("/admin/approval", approvalRouter);
  app.use("/admin/shifts", shiftsRouter);
  app.use("/admin/rider-cash", riderCashRouter);
  app.use("/admin/print-stations", printStationsRouter);
  app.use("/admin/kot", kotRouter);
  app.use("/admin/reports", reportsRouter);
  app.use("/admin", adminRouter);
  app.use("/invoices", invoicesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
