import { describe, expect, it } from "vitest";
import { execSync } from "child_process";
import path from "path";

const backendRoot = path.resolve(__dirname, "..");

describe("demo seed guards", () => {
  it("refuses production without ALLOW_DEMO_SEED", () => {
    let failed = false;
    try {
      execSync("npx tsx prisma/seed.ts", {
        cwd: backendRoot,
        env: { ...process.env, NODE_ENV: "production", ALLOW_DEMO_SEED: undefined },
        stdio: "pipe",
      });
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
