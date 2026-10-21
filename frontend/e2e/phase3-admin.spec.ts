import { test, expect } from "@playwright/test";

test.describe("Phase 3 — admin reports", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || "admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
  });

  test("dish costing and tax reports load", async ({ page }) => {
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByRole("heading", { name: /dish costing/i })).toBeVisible();
    await expect(page.getByText(/average purchase price/i)).toBeVisible();

    await page.goto("/admin/reports/tax");
    await expect(page.getByRole("heading", { name: /tax reports/i })).toBeVisible();
  });

  test("daily summary and sync conflicts pages load", async ({ page }) => {
    await page.goto("/admin/daily-summary");
    await expect(page.getByRole("heading", { name: /daily summary/i })).toBeVisible();

    await page.goto("/admin/sync-conflicts");
    await expect(page.getByRole("heading", { name: /sync conflicts/i })).toBeVisible();
  });
});
