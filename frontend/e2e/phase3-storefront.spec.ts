import { test, expect } from "@playwright/test";

test.describe("Phase 3 — storefront UX", () => {
  test("track page loads", async ({ page }) => {
    await page.goto("/track");
    await expect(page.getByRole("heading", { name: /track/i })).toBeVisible();
    await expect(page.getByPlaceholder(/ORD/i)).toBeVisible();
  });

  test("manifest is served", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.display).toBe("standalone");
  });
});
