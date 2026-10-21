import { test, expect } from "@playwright/test";

test.describe("Admin settings", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || "admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
  });

  test("branding section loads and save bar appears on edit", async ({ page }) => {
    await page.goto("/admin/settings/branding-theme");
    await expect(page.getByRole("heading", { name: /branding and theme/i })).toBeVisible();

    await page.locator("#field-storeName").fill(`E2E Store ${Date.now()}`);
    await expect(page.getByRole("region", { name: /unsaved settings/i })).toBeVisible();
    await page.getByRole("button", { name: /^discard$/i }).click();
    await expect(page.getByRole("region", { name: /unsaved settings/i })).toHaveCount(0);
  });

  test("legacy tab query redirects to hours section", async ({ page }) => {
    await page.goto("/admin/settings/hours-availability?tab=hours");
    await expect(page).toHaveURL(/\/admin\/settings\/hours-availability/);
    await expect(page.getByRole("heading", { name: /hours/i })).toBeVisible();
  });

  test("search navigates to orders section", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin/settings/orders-delivery");
    await page.getByPlaceholder(/search settings/i).fill("minimum order");
    await page.getByRole("option", { name: /minimum order/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/settings\/orders-delivery/);
  });
});

test.describe("Manager settings access", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("manager sees only my account", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_MANAGER_EMAIL || "manager@demo.restaurant");
    await page.getByLabel(/password/i).fill(process.env.E2E_MANAGER_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");

    await page.goto("/admin/settings/branding-theme");
    await page.waitForURL("**/admin**");
    expect(page.url()).not.toContain("/settings/branding-theme");

    await page.goto("/admin/settings/my-account");
    await expect(page.getByRole("heading", { name: /my account/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible();
  });
});
