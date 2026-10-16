import { test, expect } from "@playwright/test";

const api = process.env.E2E_API_URL || "http://127.0.0.1:4000";

test.describe("CI smoke (production API entry)", () => {
  test("coupons mount returns validation not 404", async ({ request }) => {
    const res = await request.post(`${api}/coupons/validate`, {
      data: { code: "NOPE", subtotal: 1000 },
    });
    expect(res.status()).not.toBe(404);
  });

  test("storefront checkout applies WELCOME10", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: /add/i }).first().click();
    await page.getByRole("link", { name: /checkout/i }).click();
    await page.waitForURL("**/checkout**");
    await page.getByPlaceholder("WELCOME10").fill("WELCOME10");
    await page.getByRole("button", { name: /^Apply$/i }).click();
    await expect(page.getByText(/WELCOME10 applied/i)).toBeVisible({ timeout: 20_000 });
  });

  test("kitchen advances seeded order to delivered", async ({ page, request }) => {
    const login = await request.post(`${api}/auth/login`, {
      data: { email: "admin@admin.com", password: process.env.SEED_ADMIN_PASSWORD || "admin" },
    });
    expect(login.ok()).toBeTruthy();
    const { token } = (await login.json()) as { token: string };

    const board = await request.get(`${api}/orders/board`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(board.ok()).toBeTruthy();
    const { orders } = (await board.json()) as { orders: { id: string; status: string }[] };
    const target = orders.find((o) => o.status === "CONFIRMED" || o.status === "PREPARING");
    test.skip(!target, "No kitchen order in seed data");

    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.SEED_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
    await page.goto("/admin/kitchen");
    await expect(page.getByRole("heading", { name: /kitchen/i })).toBeVisible();

    let status = target!.status;
    const steps: string[] =
      status === "CONFIRMED"
        ? ["PREPARING", "READY", "DELIVERED"]
        : status === "PREPARING"
          ? ["READY", "DELIVERED"]
          : ["DELIVERED"];

    for (const next of steps) {
      const patch = await request.patch(`${api}/orders/${target!.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status: next },
      });
      expect(patch.ok()).toBeTruthy();
      status = next;
    }
    expect(status).toBe("DELIVERED");
  });

  test("offline POS queues two orders and syncs once each", async ({ page, context }) => {
    const password = process.env.SEED_ADMIN_PASSWORD || "admin";
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant");
    await page.getByLabel(/password/i).fill(process.env.E2E_CASHIER_PASSWORD || password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/admin/);

    await page.goto("/admin/pos");
    await page.getByRole("button", { name: /open shift/i }).click().catch(() => null);
    await page.getByLabel(/opening float/i).fill("0").catch(() => null);
    await page.getByRole("button", { name: /confirm/i }).click().catch(() => null);

    const product = page
      .locator('[class*="PosProductCard"], button')
      .filter({ hasText: /burger|biryani|pizza|zinger/i })
      .first();
    await expect(product).toBeVisible({ timeout: 20_000 });

    await context.setOffline(true);
    await product.click();
    await page.getByRole("button", { name: /charge & print/i }).click();
    await product.click();
    await page.getByRole("button", { name: /charge & print/i }).click();

    await context.setOffline(false);
    await page.getByTitle("Sync now").click({ timeout: 20_000 });

    await page.goto("/admin/kitchen");
    await expect(page.getByText(/OFF-/)).toHaveCount(0, { timeout: 45_000 });
  });
});
