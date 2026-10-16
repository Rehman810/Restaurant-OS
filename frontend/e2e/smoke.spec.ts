import { test, expect } from "@playwright/test";

test.describe("storefront smoke", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded (see README)");

  test("home → menu → cart → checkout form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /menu/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /menu/i }).first().click();
    await page.waitForURL("**/menu**");
    const addBtn = page.getByRole("button", { name: /add/i }).first();
    await addBtn.click();
    await page.getByRole("button", { name: /bag|cart/i }).first().click();
    await page.getByRole("link", { name: /checkout/i }).click();
    await expect(page.getByText(/name/i).first()).toBeVisible();
  });
});
