import { test, expect } from "@playwright/test";
import path from "path";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "admin";
const OUT = path.join(__dirname, "../../docs/screenshots/orders");

async function staffLogin(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin**");
}

test.describe("Admin orders dispatch", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("orders page loads at 390px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/orders");
    await expect(page.getByTestId("admin-orders-dispatch")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({ path: path.join(OUT, "orders-390-light.png"), fullPage: true });
  });

  test("board view toggle", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, adminEmail, adminPassword);
    await page.goto("/admin/orders?view=board");
    await expect(page.getByTestId("admin-orders-dispatch")).toBeVisible();
    await expect(page.getByRole("button", { name: /board/i })).toBeVisible();
    await page.screenshot({ path: path.join(OUT, "orders-1440-board-light.png"), fullPage: false });
  });
});
