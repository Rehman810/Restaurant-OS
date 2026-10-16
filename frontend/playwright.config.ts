import { defineConfig, devices } from "@playwright/test";
import path from "path";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const e2eCi = process.env.E2E_CI === "1";

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: e2eCi
    ? [
        {
          command: "node scripts/e2e-api.mjs",
          cwd: path.join(__dirname, ".."),
          url: "http://127.0.0.1:4000/health",
          timeout: 180_000,
          reuseExistingServer: false,
          env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL,
            E2E_API_PORT: "4000",
            E2E_SKIP_DB_SETUP: process.env.E2E_SKIP_DB_SETUP || "0",
          },
        },
        {
          command: "npx next start -H 127.0.0.1 -p 3000",
          cwd: __dirname,
          url: baseURL,
          timeout: 180_000,
          reuseExistingServer: false,
          env: {
            ...process.env,
            PORT: "3000",
            HOSTNAME: "127.0.0.1",
            NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
            API_PROXY_TARGET: "http://127.0.0.1:4000",
          },
        },
      ]
    : undefined,
});
