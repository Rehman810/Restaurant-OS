import webpush from "web-push";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { statusLabel } from "./order-machine";
import type { FulfillmentType, OrderStatus } from "@prisma/client";
import type { OpsNotificationPayload } from "./realtime";

let configured = false;

function ensureVapid() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export async function upsertPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId?: string | null;
  orderId?: string | null;
}) {
  const endpoint = input.endpoint.trim();
  if (!endpoint || !input.p256dh || !input.auth) {
    throw Object.assign(new Error("Invalid push subscription."), { status: 400 });
  }

  const existing = await prisma.customerPushSubscription.findUnique({ where: { endpoint } });
  const orderIds = new Set(existing?.orderIds ?? []);
  if (input.orderId) orderIds.add(input.orderId);

  return prisma.customerPushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId || null,
      orderIds: [...orderIds],
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId || existing?.userId || null,
      orderIds: [...orderIds],
    },
  });
}

export async function upsertStaffPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const endpoint = input.endpoint.trim();
  if (!endpoint || !input.p256dh || !input.auth) {
    throw Object.assign(new Error("Invalid push subscription."), { status: 400 });
  }
  return prisma.staffPushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: input.userId,
      endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
    },
  });
}

export async function removeStaffPushSubscription(userId: string, endpoint: string) {
  await prisma.staffPushSubscription.deleteMany({
    where: { userId, endpoint: endpoint.trim() },
  });
}

const STAFF_PUSH_ROLES: Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.CHEF,
  Role.CASHIER,
  Role.WAITER,
  Role.RIDER,
];

export async function notifyStaffOpsPush(notification: OpsNotificationPayload) {
  if (!ensureVapid()) return;

  const subs = await prisma.staffPushSubscription.findMany({
    where: {
      user: { isActive: true, role: { in: STAFF_PUSH_ROLES } },
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          branchMembers: { select: { branchId: true } },
        },
      },
    },
  });

  if (!subs.length) return;

  const href = notification.href?.startsWith("/") ? notification.href : "/admin";
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: href,
  });

  for (const sub of subs) {
    if (notification.branchId) {
      const user = sub.user;
      if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
        const branchIds = user.branchMembers.map((m) => m.branchId);
        if (branchIds.length && !branchIds.includes(notification.branchId)) continue;
      }
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await prisma.staffPushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
      }
    }
  }
}

export async function notifyOrderStatusPush(orderId: string, status: OrderStatus, fulfillment: FulfillmentType) {
  if (!ensureVapid()) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customerId: true },
  });
  if (!order) return;

  const subs = await prisma.customerPushSubscription.findMany({
    where: {
      OR: [{ orderIds: { has: orderId } }, ...(order.customerId ? [{ userId: order.customerId }] : [])],
    },
  });
  if (!subs.length) return;

  const label = statusLabel(status, fulfillment);
  const payload = JSON.stringify({
    title: `Order ${order.orderNumber}`,
    body: label,
    url: `/orders/${order.id}`,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await prisma.customerPushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
      }
    }
  }
}
