import { test, expect } from "@playwright/test";
import path from "path";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "admin";
const managerEmail = process.env.E2E_MANAGER_EMAIL || "manager@demo.restaurant";
const cashierEmail = process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant";
const apiBase = process.env.E2E_API_URL || "http://127.0.0.1:4000";
const OUT = path.join(__dirname, "../../docs/screenshots/dish-costing");

async function staffLogin(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password: string
) {
  const login = await request.post(`${apiBase}/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
  await page.context().addCookies([{ name: "ros_session", value: token, url: base }]);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login"),
    { timeout: 30_000 }
  );
}

test.describe("Dish costing report", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("admin sees summary and table", async ({ page, request }) => {
    await staffLogin(page, request, adminEmail, adminPassword);
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByRole("heading", { name: /dish costing/i })).toBeVisible();
    await expect(page.getByText(/average food cost/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /what if/i })).toBeVisible();
  });

  test("manager can open dish costing", async ({ page, request }) => {
    await staffLogin(page, request, managerEmail, adminPassword);
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByRole("heading", { name: /dish costing/i })).toBeVisible();
  });

  test("cashier is denied", async ({ page, request }) => {
    await staffLogin(page, request, cashierEmail, adminPassword);
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByText(/admin or manager access required/i)).toBeVisible();
  });

  test("390px no horizontal scroll and screenshot", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByRole("heading", { name: /dish costing/i })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({ path: path.join(OUT, "dish-costing-390-light.png"), fullPage: true });
  });

  test("1440px desktop screenshot", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await page.goto("/admin/reports/dish-costing");
    await expect(page.getByRole("heading", { name: /dish costing/i })).toBeVisible();
    await page.screenshot({ path: path.join(OUT, "dish-costing-1440-light.png"), fullPage: false });
  });
});
