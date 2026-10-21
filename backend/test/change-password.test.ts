import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("POST /auth/change-password", () => {
  it("rejects wrong current password and updates on success", async () => {
    const app = createApp();
    const email = `change-pw-${Date.now()}@test.local`;
    const { user, token, password } = await createTestUser({ email, role: Role.MANAGER });

    const bad = await appRequest(app, "POST", "/auth/change-password", {
      headers: authHeader(token),
      body: { currentPassword: password, newPassword: "short" },
    });
    expect(bad.status).toBe(400);

    const wrong = await appRequest(app, "POST", "/auth/change-password", {
      headers: authHeader(token),
      body: { currentPassword: "wrong-pass-xyz", newPassword: "new-pass-abc" },
    });
    expect(wrong.status).toBe(400);

    const ok = await appRequest(app, "POST", "/auth/change-password", {
      headers: authHeader(token),
      body: { currentPassword: password, newPassword: "new-pass-abc" },
    });
    expect(ok.status).toBe(200);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row).toBeTruthy();
    expect(await bcrypt.compare("new-pass-abc", row!.passwordHash)).toBe(true);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
