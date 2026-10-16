import { describe, expect, it, beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { ROUTE_ROLE_MATRIX } from "./fixtures/route-role-expectations";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { loginToken, SEEDED_ACCOUNTS } from "./helpers/login";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

const PROBE_ROLES: Role[] = [
  Role.CUSTOMER,
  Role.RIDER,
  Role.CHEF,
  Role.CASHIER,
  Role.WAITER,
  Role.MANAGER,
  Role.ADMIN,
];

describe.skipIf(!hasDb)("route auth matrix (roles)", () => {
  const tokens: Partial<Record<Role, string>> = {};
  const ephemeral: string[] = [];

  beforeAll(async () => {
    const password = process.env.E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin";
    for (const role of PROBE_ROLES) {
      const email = SEEDED_ACCOUNTS[role];
      if (email) {
        try {
          tokens[role] = await loginToken(app, email, password);
        } catch {
          /* seed user missing — fall through */
        }
      }
    }

    const branch = await prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) return;

    if (!tokens[Role.MANAGER]) {
      const m = await createTestUser({
        email: `matrix-mgr-${Date.now()}@test.local`,
        role: Role.MANAGER,
        password,
      });
      await prisma.branchMember.create({ data: { branchId: branch.id, userId: m.user.id } });
      tokens[Role.MANAGER] = m.token;
      ephemeral.push(m.user.id);
    }
    if (!tokens[Role.WAITER]) {
      const w = await createTestUser({
        email: `matrix-waiter-${Date.now()}@test.local`,
        role: Role.WAITER,
        password,
      });
      await prisma.branchMember.create({ data: { branchId: branch.id, userId: w.user.id } });
      tokens[Role.WAITER] = w.token;
      ephemeral.push(w.user.id);
    }
  });

  for (const route of ROUTE_ROLE_MATRIX) {
    describe(`${route.method} ${route.path}`, () => {
      for (const role of PROBE_ROLES) {
        if (route.allowed.includes(role)) continue;
        it(`returns 403 for ${role}`, async () => {
          const token = tokens[role];
          if (!token) return;
          const res = await appRequest(app, route.method, route.path, {
            headers: authHeader(token),
            body: route.body,
          });
          expect(res.status).toBe(403);
        });
      }

      it(`allows ${route.allowed[0]}`, async () => {
        const role = route.allowed[0];
        const token = tokens[role];
        if (!token) return;
        const res = await appRequest(app, route.method, route.path, {
          headers: authHeader(token),
          body: route.body,
        });
        expect([401, 403]).not.toContain(res.status);
      });
    });
  }
});
