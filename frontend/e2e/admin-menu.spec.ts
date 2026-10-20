import { test, expect } from "@playwright/test";

test.describe("Admin menu catalog", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || "admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
  });

  test("menu tabs and deep links load", async ({ page }) => {
    await page.goto("/admin/catalog/dishes");
    await expect(page.getByRole("heading", { name: /^dishes$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search dishes/i)).toBeVisible();

    await page.goto("/admin/catalog/deals");
    await expect(page.getByRole("heading", { name: /^deals$/i })).toBeVisible();

    await page.goto("/admin/catalog/categories");
    await expect(page.getByRole("heading", { name: /^categories$/i })).toBeVisible();
  });

  test("mobile filter sheet opens on dishes tab", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/catalog/dishes");
    await page.getByRole("button", { name: /^filters/i }).click();
    await expect(page.getByRole("dialog", { name: /filters/i })).toBeVisible();
  });
});
