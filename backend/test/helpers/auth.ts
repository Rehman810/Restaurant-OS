import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/middleware/auth";

export async function createTestUser(input: {
  email: string;
  role: Role;
  password?: string;
  name?: string;
}) {
  const password = input.password || "test-pass-123";
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name || input.email.split("@")[0],
      role: input.role,
      passwordHash: hash,
      isActive: true,
    },
  });
  return {
    user,
    token: signToken({
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      tv: user.tokenVersion,
    }),
    password,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
