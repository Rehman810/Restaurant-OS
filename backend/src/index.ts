import path from "path";
import http from "http";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { createApp } from "./app";
import { startDineInJobScheduler, stopDineInJobScheduler } from "./lib/dine-in/jobs";
import { databaseHelpText, verifyDatabaseConnection } from "./lib/db-health";
import { initRealtime, shutdownRealtime } from "./lib/realtime";
import { prisma } from "./lib/prisma";

const PORT = Number(process.env.PORT || 4000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 15_000);

const jwtSecret = process.env.JWT_SECRET || "";
const weakJwt = !jwtSecret || jwtSecret.length < 32;
if (process.env.NODE_ENV === "production" && weakJwt) {
  console.error("[security] FATAL: Set JWT_SECRET to a random string of at least 32 characters.");
  process.exit(1);
}
if (weakJwt) {
  console.warn("[security] Set a strong JWT_SECRET before deploying to production.");
}

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other API process, then run npm run dev again.`);
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — closing server`);
  stopDineInJobScheduler();

  const forceTimer = setTimeout(() => {
    console.error("[shutdown] timeout — forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  server.close((err) => {
    if (err) console.error("[shutdown] HTTP close error", err);
  });

  try {
    await shutdownRealtime();
    await prisma.$disconnect();
    clearTimeout(forceTimer);
    console.log("[shutdown] complete");
    process.exit(0);
  } catch (err) {
    console.error("[shutdown] error", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

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
