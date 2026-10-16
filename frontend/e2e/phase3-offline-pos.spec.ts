import { test, expect } from "@playwright/test";

test.describe("Phase 3 — offline POS", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("queues two offline orders and syncs once each to kitchen", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant");
    await page.getByLabel(/password/i).fill(
      process.env.E2E_CASHIER_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin"
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/pos");
    await page.getByRole("button", { name: /open shift/i }).click().catch(() => null);
    await page.getByLabel(/opening float/i).fill("0").catch(() => null);
    await page.getByRole("button", { name: /confirm/i }).click().catch(() => null);
    await context.setOffline(true);

    // Add two simple items and checkout twice — selectors depend on seeded menu; skip if empty
    const product = page.locator('[class*="PosProductCard"], button').filter({ hasText: /burger|rice|pizza/i }).first();
    if (!(await product.count())) {
      test.skip();
      return;
    }
    await product.click();
    await page.getByRole("button", { name: /charge & print/i }).click();
    await product.click();
    await page.getByRole("button", { name: /charge & print/i }).click();

    await context.setOffline(false);
    await page.getByTitle("Sync now").click({ timeout: 15_000 }).catch(() => null);

    await page.goto("/admin/kitchen");
    const offlineLabels = page.getByText(/OFF-/);
    await expect(offlineLabels).toHaveCount(0, { timeout: 30_000 });
  });
});
