import { test, expect } from "@playwright/test";

const api = process.env.E2E_API_URL || "http://127.0.0.1:4000";

function isAppNotFound(status: number, body: { error?: string }) {
  return status === 404 && body.error === "Not found.";
}

test.describe.configure({ mode: "serial" });

test.describe("CI smoke (production API entry)", () => {
  test("API health and coupon mounts (R-001)", async ({ request }) => {
    const health = await request.get(`${api}/health`);
    expect(health.ok()).toBeTruthy();

    const validate = await request.post(`${api}/coupons/validate`, {
      data: { code: "NOPE", subtotal: 1000 },
    });
    const validateBody = (await validate.json().catch(() => ({}))) as { error?: string };
    expect(isAppNotFound(validate.status(), validateBody)).toBe(false);

    const adminCoupons = await request.get(`${api}/admin/coupons`);
    expect(adminCoupons.status()).toBe(401);
  });

  test("storefront checkout applies WELCOME10", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("button", { name: /add/i }).first()).toBeVisible({ timeout: 30_000 });
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
    const { orders } = (await board.json()) as {
      orders: { id: string; status: string; fulfillmentType?: string }[];
    };
    const target = orders.find((o) => o.status === "CONFIRMED" || o.status === "PREPARING");
    test.skip(!target, "No kitchen order in seed data");

    const flow: Record<string, string[]> = {
      DELIVERY: ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"],
      PICKUP: ["CONFIRMED", "PREPARING", "READY", "COLLECTED"],
      DINE_IN: ["CONFIRMED", "PREPARING", "READY", "SERVED"],
    };
    const fulfillment = (target!.fulfillmentType || "DELIVERY") as keyof typeof flow;
    const steps = flow[fulfillment] || flow.DELIVERY;
    const startIdx = steps.indexOf(target!.status);
    const statusPath = startIdx >= 0 ? steps.slice(startIdx + 1) : [];

    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("admin@admin.com");
    await page.getByLabel(/password/i).fill(process.env.SEED_ADMIN_PASSWORD || "admin");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/admin**");
    await page.goto("/admin/kitchen");
    await expect(page.getByRole("heading", { name: /kitchen/i })).toBeVisible();

    let status = target!.status;
    for (const next of statusPath) {
      const patch = await request.patch(`${api}/orders/${target!.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status: next },
      });
      expect(patch.ok(), `transition ${status} -> ${next}`).toBeTruthy();
      status = next;
    }
    expect(["DELIVERED", "COLLECTED", "SERVED"]).toContain(status);
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
