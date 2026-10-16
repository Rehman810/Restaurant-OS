import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env.test") });
dotenv.config({ path: path.join(backendRoot, ".env") });

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
}

const vitestArgs = process.argv.slice(2);
execSync(`npx vitest run ${vitestArgs.join(" ")}`.trim(), {
  cwd: backendRoot,
  stdio: "inherit",
  env: process.env,
});
