import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";
import { loadPlatformSettings, updatePlatformSettings } from "../src/lib/platform/platform-settings";
import { invalidateMaintenanceCache } from "../src/lib/platform/maintenance";

const hasDb = Boolean(process.env.DATABASE_URL?.includes("test"));
const app = createApp();

describe.skipIf(!hasDb)("maintenance mode", () => {
  it("blocks tenant writes while allowing reads", async () => {
    const { version } = await loadPlatformSettings();
    await updatePlatformSettings(version, {
      maintenance: { active: true, message: "Maintenance test window." },
    });
    invalidateMaintenanceCache();

    const post = await appRequest(app, "POST", "/orders", { body: { items: [] } });
    expect(post.status).toBe(503);

    const menu = await appRequest(app, "GET", "/menu");
    expect(menu.status).toBe(200);

    const { version: v2 } = await loadPlatformSettings();
    await updatePlatformSettings(v2, { maintenance: { active: false } });
    invalidateMaintenanceCache();
  });
});
