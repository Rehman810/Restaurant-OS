import { test } from "@playwright/test";
import path from "path";

const OUT = path.join(__dirname, "../../docs/screenshots/pos");

test.describe("POS screenshots", () => {
  test.skip(!process.env.E2E_RUN, "Set E2E_RUN=1 with API + DB seeded");

  for (const width of [390, 768, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${width}px ${theme}`, async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel(/email/i).fill(process.env.E2E_CASHIER_EMAIL || "cashier@demo.restaurant");
        await page.getByLabel(/password/i).fill(
          process.env.E2E_CASHIER_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin"
        );
        await page.getByRole("button", { name: /sign in/i }).click();
        await page.waitForURL(/\/admin/);
        if (theme === "dark") {
          await page.evaluate(() => document.documentElement.classList.add("dark"));
        }
        await page.setViewportSize({ width, height: Math.round(width * 1.8) });
        await page.goto("/admin/pos");
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(OUT, `pos-${width}-${theme}.png`),
          fullPage: true,
        });
      });
    }
  }
});
