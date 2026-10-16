import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests share one Postgres — avoid cross-file branch/user races.
    fileParallelism: false,
    pool: "threads",
  },
});
