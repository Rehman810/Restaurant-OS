import { describe, expect, it, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { ensureDefaultBranch } from "../src/lib/branch-scope";
import { ROUTE_ROLE_MATRIX } from "./fixtures/route-role-expectations";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";
import { ensureBranchMember } from "./helpers/branch-member";
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

  beforeAll(async () => {
    const password = process.env.E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin";
    const suffix = randomUUID().slice(0, 8);

    for (const role of PROBE_ROLES) {
      const email = SEEDED_ACCOUNTS[role];
      if (!email) continue;
      try {
        tokens[role] = await loginToken(app, email, password);
      } catch {
        /* seeded user missing */
      }
    }

    if (!tokens[Role.ADMIN]) {
      throw new Error(
        "route-auth-roles requires demo seed (admin@admin.com). Run seed:demo or enable CI seed step."
      );
    }

    const branchId = await ensureDefaultBranch();

    async function ensureEphemeralRole(role: Role) {
      if (tokens[role]) return;
      const created = await createTestUser({
        email: `matrix-${role.toLowerCase()}-${suffix}@test.local`,
        role,
        password,
      });
      await ensureBranchMember(created.user.id, branchId);
      tokens[role] = created.token;
    }

    await ensureEphemeralRole(Role.MANAGER);
    await ensureEphemeralRole(Role.WAITER);
  });

  for (const route of ROUTE_ROLE_MATRIX) {
    describe(`${route.method} ${route.path}`, () => {
      for (const role of PROBE_ROLES) {
        if (route.allowed.includes(role)) continue;
        it(`returns 403 for ${role}`, async () => {
          const token = tokens[role];
          expect(token, `missing token for ${role}`).toBeTruthy();
          const res = await appRequest(app, route.method, route.path, {
            headers: authHeader(token!),
            body: route.body,
          });
          expect(res.status).toBe(403);
        });
      }

      it(`allows ${route.allowed[0]}`, async () => {
        const role = route.allowed[0];
        const token = tokens[role];
        expect(token, `missing token for ${role}`).toBeTruthy();
        const res = await appRequest(app, route.method, route.path, {
          headers: authHeader(token!),
          body: route.body,
        });
        expect([401, 403]).not.toContain(res.status);
      });
    });
  }
});
