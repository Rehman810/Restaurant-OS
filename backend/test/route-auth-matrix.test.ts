import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { listAppRoutes } from "../src/lib/list-routes";
import { PUBLIC_ROUTE_PREFIXES } from "./fixtures/route-role-expectations";
import { appRequest } from "./helpers/app-request";

function samplePath(path: string) {
  return path.replace(/:[^/]+/g, "00000000-0000-4000-8000-000000000099");
}

function isPublicRoute(method: string, path: string) {
  const key = `${method} ${path}`;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => key.startsWith(prefix) || key.includes(prefix.replace(/\/$/, "")));
}

describe("route auth matrix (unauthenticated)", () => {
  const app = createApp();
  const routes = listAppRoutes(app).filter((r) => r.auth !== "public" && !isPublicRoute(r.method, r.path));

  for (const route of routes) {
    it(`${route.method} ${route.path} rejects anonymous callers`, async () => {
      const path = samplePath(route.path);
      const res = await appRequest(app, route.method, path, {
        body: route.method === "GET" || route.method === "DELETE" ? undefined : {},
      });
      expect([401, 403]).toContain(res.status);
    });
  }
});
