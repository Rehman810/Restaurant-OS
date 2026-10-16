import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { AuthUser } from "../middleware/auth";
import { userCanAccessBranch } from "./branch-scope";
import { ORDER_OPS } from "./roles";

import { jwtSecret } from "./jwt-secret";

const JWT_SECRET = jwtSecret();

type OrderAccess = {
  id?: string;
  branchId?: string | null;
  customerId: string | null;
  riderId: string | null;
  guestAccessToken: string | null;
};

export function signOrderViewToken(orderId: string) {
  return jwt.sign({ oid: orderId, typ: "order-view" }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyOrderViewToken(token: string, orderId: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { oid?: string; typ?: string };
    return payload.typ === "order-view" && payload.oid === orderId;
  } catch {
    return false;
  }
}

export async function canAccessOrder(order: OrderAccess, user?: AuthUser, token?: string | null) {
  if (user?.role === Role.ADMIN) return true;
  if (user && order.customerId && order.customerId === user.id) return true;
  if (user && order.riderId && order.riderId === user.id) return true;
  if (token && order.id && verifyOrderViewToken(token, order.id)) return true;
  if (token && order.guestAccessToken && token === order.guestAccessToken) return true;
  if (user && order.branchId && ORDER_OPS.includes(user.role)) {
    return userCanAccessBranch(user, order.branchId);
  }
  return false;
}

export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

export function phonesMatch(stored: string, input: string) {
  const a = phoneDigits(stored);
  const b = phoneDigits(input);
  if (a.length < 10 || b.length < 10) return false;
  return a.slice(-10) === b.slice(-10);
}

export function stripGuestToken<T extends { guestAccessToken?: string | null }>(order: T) {
  const { guestAccessToken: _guestAccessToken, ...rest } = order;
  return rest;
}
