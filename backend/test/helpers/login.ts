import type { Application } from "express";
import { Role } from "@prisma/client";
import { appRequest } from "./app-request";

export async function loginToken(
  app: Application,
  email: string,
  password = process.env.E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin"
): Promise<string> {
  const res = await appRequest(app, "POST", "/auth/login", { body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const token = (res.body as { token?: string }).token;
  if (!token) throw new Error(`No token for ${email}`);
  return token;
}

export const SEEDED_ACCOUNTS: Partial<Record<Role, string>> = {
  [Role.ADMIN]: "admin@admin.com",
  [Role.CUSTOMER]: "customer@demo.restaurant",
  [Role.CASHIER]: "cashier@demo.restaurant",
  [Role.CHEF]: "chef@demo.restaurant",
  [Role.RIDER]: "rider@demo.restaurant",
};
