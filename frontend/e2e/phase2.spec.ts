import { test, expect } from "@playwright/test";

test.describe("phase 2 flows", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded (see docs/PHASE2.md)");

  test("coupon validate API via checkout UI", async ({ page }) => {
    await page.goto("/menu");
    const addBtn = page.getByRole("button", { name: /add/i }).first();
    await addBtn.click();
    await page.getByRole("link", { name: /checkout/i }).click();
    await page.waitForURL("**/checkout**");
    await page.getByPlaceholder("WELCOME10").fill("WELCOME10");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await expect(page.getByText(/WELCOME10 applied/i)).toBeVisible({ timeout: 15_000 });
  });

  test("admin coupons page loads for manager", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("admin@admin.com");
    await page.getByLabel(/password/i).fill("admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
    await page.goto("/admin/catalog/vouchers");
    await expect(page.getByRole("heading", { name: /vouchers/i })).toBeVisible();
    await expect(page.getByText(/WELCOME10/i)).toBeVisible();
  });
});
