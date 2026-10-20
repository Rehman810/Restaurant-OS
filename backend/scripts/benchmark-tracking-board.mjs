import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync("npx", ["tsx", path.join(__dirname, "benchmark-tracking-board.ts")], {
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
