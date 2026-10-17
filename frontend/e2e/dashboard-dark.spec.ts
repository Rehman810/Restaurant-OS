import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Admin dashboard dark theme", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("capture 390 and 1440 dark screenshots", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL || "admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");

    await page.evaluate(() => {
      document.documentElement.setAttribute("data-admin-theme", "dark");
      localStorage.setItem("uff-admin-theme", "dark");
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "dashboard", "admin-390-dark.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "dashboard", "admin-1440-dark.png"),
      fullPage: false,
    });
  });
});
