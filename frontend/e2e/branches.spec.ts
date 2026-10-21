import { test, expect } from "@playwright/test";

test.describe("Branches admin", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || "admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
  });

  test("branches page loads and fits mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/branches");
    await expect(page.getByRole("heading", { name: /^Branches$/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(overflow).toBe(true);
  });
});
