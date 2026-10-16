import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { appRequest } from "./helpers/app-request";

describe("public dine-in API", () => {
  const app = createApp();

  it("rejects booking without email", async () => {
    const res = await appRequest(app, "POST", "/dine-in/reservations", {
      body: {
        branchId: "00000000-0000-4000-8000-000000000001",
        guestName: "Test",
        guestPhone: "03001234567",
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error?: string }).error).toMatch(/email/i);
  });

  it("rejects booking without phone", async () => {
    const res = await appRequest(app, "POST", "/dine-in/reservations", {
      body: {
        branchId: "00000000-0000-4000-8000-000000000001",
        guestName: "Test",
        guestEmail: "a@example.com",
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error?: string }).error).toMatch(/mobile/i);
  });

  it("rejects honeypot", async () => {
    const res = await appRequest(app, "POST", "/dine-in/reservations", {
      body: {
        branchId: "x",
        guestName: "Bot",
        guestEmail: "bot@example.com",
        guestPhone: "03001234567",
        startsAt: new Date(Date.now() + 3600_000).toISOString(),
        website: "http://spam.test",
      },
    });
    expect(res.status).toBe(400);
  });
});
