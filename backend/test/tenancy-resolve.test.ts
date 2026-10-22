import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { resolveRestaurantIdFromRequest, resolveRequestHost } from "../src/lib/tenant-resolve";
import { DEFAULT_RESTAURANT_ID } from "../src/lib/restaurant-context";

function mockReq(headers: Record<string, string> = {}, hostname = "127.0.0.1"): Request {
  return {
    hostname,
    headers,
    header(name: string) {
      const key = Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
  } as Request;
}

describe("tenant resolution", () => {
  it("uses trusted proxy host when the secret matches", () => {
    process.env.TENANT_PROXY_SECRET = "test-secret";
    const req = mockReq({
      "x-tenant-proxy-secret": "test-secret",
      "x-tenant-host": "orders.example.com",
    });
    expect(resolveRequestHost(req)).toBe("orders.example.com");
    delete process.env.TENANT_PROXY_SECRET;
  });

  it("ignores proxy host when the secret is wrong", () => {
    process.env.TENANT_PROXY_SECRET = "test-secret";
    const req = mockReq({
      "x-tenant-proxy-secret": "wrong",
      "x-tenant-host": "orders.example.com",
    });
    expect(resolveRequestHost(req)).toBe("127.0.0.1");
    delete process.env.TENANT_PROXY_SECRET;
  });

  it("resolves localhost with test fallback", async () => {
    const prev = process.env.SINGLE_TENANT_MODE;
    process.env.SINGLE_TENANT_MODE = "true";
    const id = await resolveRestaurantIdFromRequest(mockReq());
    expect(id).toBe(process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID);
    process.env.SINGLE_TENANT_MODE = prev;
  });
});
