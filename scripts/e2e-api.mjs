import { spawn } from "child_process";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const backend = path.join(root, "backend");

const env = {
  ...process.env,
  PORT: process.env.E2E_API_PORT || "4000",
  JWT_SECRET: process.env.JWT_SECRET || "e2e-jwt-secret-with-at-least-32-characters",
  CLIENT_URL: process.env.CLIENT_URL || "http://127.0.0.1:3000",
  NODE_ENV: "development",
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "admin",
};

if (!env.DATABASE_URL) {
  console.error("[e2e-api] DATABASE_URL is required");
  process.exit(1);
}

console.log("[e2e-api] migrate + seed…");
execSync("npx prisma migrate deploy", { cwd: backend, env, stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { cwd: backend, env, stdio: "inherit" });

console.log("[e2e-api] starting production entry (index.ts)…");
const child = spawn("npx", ["tsx", "src/index.ts"], {
  cwd: backend,
  env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
