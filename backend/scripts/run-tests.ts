import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";
import { isTestDatabaseUrl } from "../src/lib/test-users";

const backendRoot = path.resolve(__dirname, "..");
const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
/** Snapshot workflow env before dotenv — npm test must not use committed backend/.env.test (port 5433) on CI. */
const databaseUrlFromEnv = process.env.DATABASE_URL;

dotenv.config({ path: path.join(backendRoot, ".env") });
if (!isCi) {
  dotenv.config({ path: path.join(backendRoot, ".env.test"), override: true });
}

if (databaseUrlFromEnv) {
  process.env.DATABASE_URL = databaseUrlFromEnv;
} else if (isCi) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/restaurant_os_ci?schema=public";
}

process.env.NODE_ENV = process.env.NODE_ENV || "test";

if (
  process.env.DATABASE_URL &&
  !isTestDatabaseUrl(process.env.DATABASE_URL) &&
  process.env.ALLOW_TESTS_ON_DEV_DB !== "1"
) {
  console.error(
    "[test] Refusing to run: DATABASE_URL does not look like a test database.\n" +
      "Use backend/.env.test (e.g. restaurant_os_test) or set ALLOW_TESTS_ON_DEV_DB=1 intentionally."
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.warn(
    "[test] DATABASE_URL is not set. Start test Postgres: npm run test:db:up (from repo root) and copy backend/.env.test.example to backend/.env.test"
  );
} else {
  execSync("npx prisma migrate deploy", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (process.env.GITHUB_ACTIONS === "true" || process.env.SEED_TEST_DB === "1") {
    execSync("npx tsx prisma/seed.ts", {
      cwd: backendRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
        SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "admin",
      },
    });
  }
}

const vitestArgs = process.argv.slice(2);
execSync(`npx vitest run ${vitestArgs.join(" ")}`.trim(), {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env,
});
