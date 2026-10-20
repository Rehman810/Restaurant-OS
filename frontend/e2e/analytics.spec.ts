import { test, expect } from "@playwright/test";
import path from "path";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "admin";

async function staffLogin(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin**");
}

test.describe("Admin analytics", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("loads overview and URL preset updates", async ({ page }) => {
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/analytics?preset=this_month&compare=previous");
    await expect(page.getByTestId("admin-analytics")).toBeVisible();
    await expect(page.getByText("Collected", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page).toHaveURL(/preset=today/);
  });

  test("desktop layout at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/analytics?preset=this_month");
    await expect(page.getByTestId("admin-analytics")).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "analytics", "admin-1440-light.png"),
      fullPage: true,
    });
  });

  test("dark theme at 390px", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/analytics");
    await expect(page.getByTestId("admin-analytics")).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "analytics", "admin-390-dark.png"),
      fullPage: true,
    });
  });

  test("no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/analytics");
    await expect(page.getByTestId("admin-analytics")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(overflow).toBe(true);
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "analytics", "admin-390-light.png"),
      fullPage: true,
    });
  });
});
