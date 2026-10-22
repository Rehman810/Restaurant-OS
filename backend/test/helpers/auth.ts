import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { DEFAULT_RESTAURANT_ID, runWithRestaurant } from "../../src/lib/restaurant-context";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/middleware/auth";
import { assertSafeToCreateTestUsers } from "../../src/lib/test-users";
import { registerTestUserId } from "./test-user-registry";

export async function createTestUser(input: {
  email: string;
  role: Role;
  password?: string;
  name?: string;
}) {
  assertSafeToCreateTestUsers();
  const password = input.password || "test-pass-123";
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name || input.email.split("@")[0],
      role: input.role,
      passwordHash: hash,
      isActive: true,
      isTest: true,
    },
  });
  registerTestUserId(user.id);
  return {
    user,
    token: signToken({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      tv: user.tokenVersion,
      rid: DEFAULT_RESTAURANT_ID,
    }),
    password,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Creates a test user scoped to a specific tenant (multi-tenant isolation tests). */
export async function createTestUserInTenant(
  restaurantId: string,
  input: {
    email: string;
    role: Role;
    password?: string;
    name?: string;
  }
) {
  return runWithRestaurant(restaurantId, async () => createTestUser(input)).then(async (base) => ({
    ...base,
    token: signToken({
      id: base.user.id,
      role: base.user.role,
      email: base.user.email,
      name: base.user.name,
      tv: base.user.tokenVersion,
      rid: restaurantId,
    }),
  }));
}

export function tenantSlugHeader(slug: string) {
  return { "X-Tenant-Slug": slug };
}
