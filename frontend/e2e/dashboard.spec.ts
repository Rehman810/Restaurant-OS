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

test.describe("Admin dashboard", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("admin dashboard loads and has no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "dashboard", "admin-390-light.png"),
      fullPage: true,
    });
  });

  test("manager sees financial KPI labels", async ({ page }) => {
    const mgrEmail = process.env.E2E_MANAGER_EMAIL;
    const mgrPass = process.env.E2E_MANAGER_PASSWORD;
    test.skip(!mgrEmail || !mgrPass, "Set E2E_MANAGER_EMAIL/PASSWORD for manager role test");
    await staffLogin(page, mgrEmail!, mgrPass!);
    await page.goto("/admin");
    await expect(page.getByText("Booked", { exact: false })).toBeVisible();
    await expect(page.getByText("Collected", { exact: false })).toBeVisible();
  });

  test("chef dashboard hides booked revenue KPI card", async ({ page }) => {
    const chefEmail = process.env.E2E_CHEF_EMAIL;
    const chefPass = process.env.E2E_CHEF_PASSWORD;
    test.skip(!chefEmail || !chefPass, "Set E2E_CHEF_EMAIL/PASSWORD for chef role test");
    await staffLogin(page, chefEmail!, chefPass!);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByText("Booked", { exact: true })).toHaveCount(0);
  });

  test("desktop screenshot 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin");
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await page.screenshot({
      path: path.join(__dirname, "..", "..", "docs", "screenshots", "dashboard", "admin-1440-light.png"),
      fullPage: false,
    });
  });
});
