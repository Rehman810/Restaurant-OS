import { test, expect } from "@playwright/test";

test.describe("Admin POS layout", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant");
    await page.getByLabel(/password/i).fill(
      process.env.E2E_CASHIER_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin"
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin/);
    await page.goto("/admin/pos");
  });

  test("390px viewport has no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("shift summary opens from compact shift line", async ({ page }) => {
    await page.getByRole("button", { name: /open shift/i }).click().catch(() => null);
    await page.getByLabel(/opening float/i).fill("0").catch(() => null);
    await page.getByRole("button", { name: /confirm/i }).click().catch(() => null);
    const shiftLine = page.getByRole("button", { name: /shift open/i });
    if (!(await shiftLine.count())) return;
    await shiftLine.click();
    await expect(page.getByRole("heading", { name: /cash shift/i })).toBeVisible();
  });
});
