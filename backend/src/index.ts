import path from "path";
import http from "http";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { authRouter } from "./routes/auth";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { riderRouter } from "./routes/rider";
import { adminRouter } from "./routes/admin";
import { auditLogsRouter } from "./routes/audit-logs";
import { approvalRouter } from "./routes/approval";
import { shiftsRouter } from "./routes/shifts";
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
import { startDineInJobScheduler } from "./lib/dine-in/jobs";
import { databaseHelpText, verifyDatabaseConnection } from "./lib/db-health";
import { UPLOAD_DIR } from "./lib/uploads";
import { initRealtime } from "./lib/realtime";
import { resolveRestaurantId, runWithRestaurant } from "./lib/prisma";
import {
  allowedOrigins,
  errorHandler,
  globalLimiter,
  notFound,
  securityHeaders,
} from "./middleware/security";
import { csrfProtection } from "./middleware/csrf";

const app = express();
const PORT = Number(process.env.PORT || 4000);

const jwtSecret = process.env.JWT_SECRET || "";
const weakJwt = !jwtSecret || jwtSecret.length < 32;
if (process.env.NODE_ENV === "production" && weakJwt) {
  console.error("[security] FATAL: Set JWT_SECRET to a random string of at least 32 characters.");
  process.exit(1);
}
if (weakJwt) {
  console.warn("[security] Set a strong JWT_SECRET before deploying to production.");
}

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
app.use("/admin", adminRouter);
app.use("/invoices", invoicesRouter);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other API process, then run npm run dev again.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Restaurant OS API on http://localhost:${PORT}`);
  void (async () => {
    const check = await verifyDatabaseConnection();
    if (!check.ok) {
      console.error("[database] Connection failed:", check.message);
      console.error(databaseHelpText());
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
    startDineInJobScheduler();
  })();
});
