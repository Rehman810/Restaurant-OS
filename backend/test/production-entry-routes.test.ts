import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest, type AppResponse } from "./helpers/app-request";

function isUnmountedRoute(res: AppResponse) {
  return res.status === 404 && (res.body as { error?: string }).error === "Not found.";
}

/**
 * Production boots `createApp()` from app.ts via index.ts (R-001).
 * Unauthenticated requests must not receive 404 for mounted routers.
 */
describe("production API route mounts", () => {
  const app = createApp();

  const mountedChecks: { method: "get" | "post"; path: string; expectAuth?: boolean }[] = [
    { method: "post", path: "/coupons/validate" },
    { method: "get", path: "/admin/coupons", expectAuth: true },
    { method: "get", path: "/admin/rider-cash/summary", expectAuth: true },
    { method: "get", path: "/admin/print-stations", expectAuth: true },
    {
      method: "get",
      path: "/admin/kot/orders/00000000-0000-4000-8000-000000000099",
      expectAuth: true,
    },
  ];

  for (const { method, path, expectAuth } of mountedChecks) {
    it(`${method.toUpperCase()} ${path} is mounted`, async () => {
      const res =
        method === "get"
          ? await appRequest(app, "GET", path)
          : await appRequest(app, "POST", path, { body: { code: "X", subtotal: 0 } });
      expect(isUnmountedRoute(res)).toBe(false);
      if (expectAuth) {
        expect([401, 403]).toContain(res.status);
      }
    });
  }
});
