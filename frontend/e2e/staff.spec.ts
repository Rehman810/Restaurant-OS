import { test, expect } from "@playwright/test";
import path from "path";

const OUT = path.join(__dirname, "..", "..", "docs", "screenshots", "staff");
const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "admin";

async function staffLogin(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin**");
}

test.describe("Admin staff", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("loads at 390px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /^Staff$/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({ path: path.join(OUT, "staff-390-light.png"), fullPage: true });
  });

  test("manager can open staff when URL is used", async ({ page }) => {
    const mgrEmail = process.env.E2E_MANAGER_EMAIL;
    const mgrPass = process.env.E2E_MANAGER_PASSWORD || adminPassword;
    test.skip(!mgrEmail, "E2E_MANAGER_EMAIL not set");
    await staffLogin(page, mgrEmail!, mgrPass!);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: /^Staff$/i })).toBeVisible({ timeout: 10_000 });
  });

  test("768px and 1440px screenshots", async ({ page }) => {
    await staffLogin(page, adminEmail, adminPassword);
    for (const [w, name] of [
      [768, "staff-768-light.png"],
      [1440, "staff-1440-light.png"],
    ] as const) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/admin/staff");
      await expect(page.getByRole("heading", { name: /^Staff$/i })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    }
  });
});
