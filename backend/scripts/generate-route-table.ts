import fs from "fs";
import path from "path";
import { createApp } from "../src/app";
import { formatRouteTable, listAppRoutes } from "../src/lib/list-routes";

const app = createApp();
const table = formatRouteTable(listAppRoutes(app));
const outPath = path.resolve(__dirname, "../../docs/audit/route-table.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, table, "utf8");
console.log(`Wrote ${outPath} (${listAppRoutes(app).length} routes)`);
