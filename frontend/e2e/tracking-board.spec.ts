import { test, expect } from "@playwright/test";
import path from "path";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "admin";
const chefEmail = process.env.E2E_CHEF_EMAIL || "chef@demo.restaurant";
const cashierEmail = process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant";
const managerEmail = process.env.E2E_MANAGER_EMAIL || "manager@demo.restaurant";
const OUT = path.join(__dirname, "../../docs/screenshots/tracking");
const apiBase = process.env.E2E_API_URL || "http://127.0.0.1:4000";

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

async function openLiveBoard(page: import("@playwright/test").Page) {
  await page.goto("/admin/tracking", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/tracking/);
  await expect(page.getByRole("heading", { name: "Live board" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("admin-tracking-board")).toBeVisible({ timeout: 15_000 });
}

test.describe("Admin live board", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  test("tracking loads at 390px without horizontal overflow", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await openLiveBoard(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({ path: path.join(OUT, "tracking-390-light.png"), fullPage: true });
  });

  test("mobile lane tab shows action buttons on cards", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await openLiveBoard(page);
    await expect(page.getByRole("tablist", { name: /order status lanes/i })).toBeVisible();
    const actionBtn = page.getByRole("button", { name: /confirm|preparing|ready|complete|picked|served|delivery/i }).first();
    if (await actionBtn.isVisible().catch(() => false)) {
      await expect(actionBtn).toBeVisible();
      const box = await actionBtn.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("desktop board at 1440", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await openLiveBoard(page);
    await page.screenshot({ path: path.join(OUT, "tracking-1440-light.png"), fullPage: false });
  });

  test("tablet width 768 without horizontal overflow", async ({ page, request }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await openLiveBoard(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
    await page.screenshot({ path: path.join(OUT, "tracking-768-light.png"), fullPage: true });
  });

  test("cashier sees board without assign rider on cards", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, cashierEmail, adminPassword);
    await openLiveBoard(page);
    await expect(page.getByRole("button", { name: /^Assign rider$/i })).toHaveCount(0);
  });

  test("manager can open live board", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, managerEmail, adminPassword);
    await openLiveBoard(page);
  });

  test("TV mode screenshot at 1440", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await page.goto("/admin/tracking?tv=1", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      sessionStorage.setItem("uff-tracking-tv", "1");
      window.dispatchEvent(new Event("tracking-tv-change"));
    });
    await expect(page.getByTestId("admin-tracking-board")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT, "tracking-tv-1440.png"),
      fullPage: false,
    });
  });

  test("chef is redirected away from tracking", async ({ page, request }) => {
    await staffLogin(page, request, chefEmail, adminPassword);
    await page.goto("/admin/tracking");
    await expect(page).toHaveURL(/\/admin\/kitchen/);
  });

  test("orders grid board uses shared test id column data", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await staffLogin(page, request, adminEmail, adminPassword);
    await openLiveBoard(page);
    const trackingActive = await page
      .getByTestId("admin-tracking-board")
      .getByRole("button")
      .filter({ has: page.getByText("Active", { exact: true }) })
      .locator("p.text-lg")
      .first()
      .textContent({ timeout: 15_000 });
    await page.goto("/admin/orders?view=board", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-orders-dispatch")).toBeVisible({ timeout: 15_000 });
    const ordersActive = page.locator('[data-testid="admin-orders-dispatch"]').getByText("Active", {
      exact: true,
    });
    await expect(ordersActive).toBeVisible();
    if (trackingActive?.trim()) {
      await expect(page.getByTestId("admin-orders-dispatch")).toContainText(trackingActive.trim());
    }
  });

  test("capture dark theme screenshots at 390 and 1440", async ({ page, request }) => {
    await staffLogin(page, request, adminEmail, adminPassword);
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-admin-theme", "dark");
      localStorage.setItem("uff-admin-theme", "dark");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openLiveBoard(page);
    await page.screenshot({ path: path.join(OUT, "tracking-390-dark.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/tracking", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-tracking-board")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT, "tracking-1440-dark.png"), fullPage: false });
  });
});
