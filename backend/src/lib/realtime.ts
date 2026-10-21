import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { allowedOrigins } from "../middleware/security";
import { prisma } from "./prisma";

import { jwtSecret } from "./jwt-secret";
import { readSessionCookie } from "./session-cookie";

const JWT_SECRET = jwtSecret();

type SocketUser = { id: string; role: Role };

let io: Server | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins(), credentials: true },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    const token =
      String(socket.handshake.auth?.token || "") ||
      readSessionCookie(socket.handshake.headers.cookie) ||
      "";
    if (!token) return next();
    try {
      const payload = jwt.verify(token, JWT_SECRET) as SocketUser & { tv?: number; typ?: string };
      const account = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { isActive: true, role: true, tokenVersion: true },
      });
      if (!account?.isActive) return next();
      const tv = typeof payload.tv === "number" ? payload.tv : 0;
      if (tv !== account.tokenVersion) return next();
      socket.data.user = { id: payload.id, role: account.role };
      next();
    } catch {
      next();
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.data.user as SocketUser | undefined;
    if (
      user?.role === Role.ADMIN ||
      user?.role === Role.MANAGER ||
      user?.role === Role.CHEF ||
      user?.role === Role.CASHIER ||
      user?.role === Role.WAITER
    ) {
      socket.join("ops");
      if (user) {
        const memberships = await prisma.branchMember.findMany({
          where: { userId: user.id },
          select: { branchId: true },
        });
        for (const m of memberships) socket.join(`branch:${m.branchId}`);
      }
    }
    if (user?.role === Role.RIDER) {
      socket.join(`rider:${user.id}`);
    }
    if (user?.role === Role.CUSTOMER) {
      socket.join(`customer:${user.id}`);
    }
    if (user) socket.join(`user:${user.id}`);

    socket.on("watch-order", async (payload: string | { orderId?: string; token?: string }) => {
      const orderId = typeof payload === "string" ? payload : payload?.orderId;
      const token = typeof payload === "object" ? payload?.token : undefined;
      if (!orderId || orderId.length > 80) return;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, riderId: true, guestAccessToken: true },
      });
      if (!order) return;

      const u = socket.data.user as SocketUser | undefined;
      const allowed =
        (u?.role === Role.ADMIN || u?.role === Role.CHEF || u?.role === Role.CASHIER) ||
        (u && order.customerId === u.id) ||
        (u && order.riderId === u.id) ||
        (token && order.guestAccessToken && token === order.guestAccessToken);

      if (allowed) socket.join(`order:${orderId}`);
    });
  });

  return io;
}

export function shutdownRealtime(): Promise<void> {
  if (!io) return Promise.resolve();
  const server = io;
  io = null;
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function emitOrderChange(
  event: "order:created" | "order:updated",
  order: {
    id: string;
    branchId?: string | null;
    riderId?: string | null;
    customerId?: string | null;
    orderNumber?: string;
    total?: number | string | { toString(): string };
    source?: string | null;
    status?: string;
  }
) {
  if (!io) return;
  const payload = { event, orderId: order.id, at: Date.now() };
  io.to("ops").emit(event, payload);
  io.to(`order:${order.id}`).emit(event, payload);
  if (order.customerId) io.to(`customer:${order.customerId}`).emit(event, payload);
  if (order.riderId) io.to(`rider:${order.riderId}`).emit(event, payload);
  emitTrackingBoardDelta(
    order.branchId,
    event === "order:created" ? "order_created" : "order_transitioned",
    { orderId: order.id }
  );

  if (event === "order:created" && order.orderNumber) {
    void import("./notifications/ops").then(({ notifyOrderCreated }) => {
      notifyOrderCreated({
        id: order.id,
        orderNumber: order.orderNumber!,
        branchId: order.branchId,
        total: order.total != null ? Number(order.total) : undefined,
        source: order.source ?? null,
      });
    });
  }
}

export type TrackingBoardDeltaKind =
  | "order_created"
  | "order_transitioned"
  | "rider_assigned"
  | "rider_location";

export function emitTrackingBoardDelta(
  branchId: string | null | undefined,
  kind: TrackingBoardDeltaKind,
  payload: { orderId: string; riderId?: string }
) {
  if (!io) return;
  const body = { kind, at: Date.now(), ...payload };
  io.to("ops").emit("tracking:board-delta", body);
  if (branchId) io.to(`branch:${branchId}`).emit("tracking:board-delta", body);
}

export type KitchenAlertPayload = {
  type: "kitchen_reject_order" | "kitchen_reject_item" | "menu_86";
  orderId: string;
  orderNumber: string;
  message: string;
};

export function emitKitchenAlert(alert: KitchenAlertPayload) {
  if (!io) return;
  io.to("ops").emit("kitchen:alert", { ...alert, at: Date.now() });
  void import("./notifications/ops").then(({ notifyKitchenAlert }) => notifyKitchenAlert(alert));
}

export type OpsNotificationPayload = {
  id: string;
  kind: string;
  title: string;
  message: string;
  at: number;
  branchId?: string;
  href?: string;
  severity: "info" | "warning" | "urgent";
  meta?: Record<string, string | number | boolean | null>;
};

/** Unified staff notification feed (orders, inventory, menu, bookings). */
export function emitOpsNotification(notification: OpsNotificationPayload) {
  if (!io) return;
  io.to("ops").emit("ops:notification", notification);
  if (notification.branchId) {
    io.to(`branch:${notification.branchId}`).emit("ops:notification", notification);
  }
  void import("./web-push").then(({ notifyStaffOpsPush }) => notifyStaffOpsPush(notification));
}

/** Broadcast menu/catalog changes (storefront, POS, kitchen refetch). */
export function emitMenuCatalogChanged(branchIds?: string[]) {
  if (!io) return;
  const payload = { at: Date.now() };
  io.emit("menu:catalog-changed", payload);
  io.to("ops").emit("menu:catalog-changed", payload);
  const ids = branchIds?.length ? [...new Set(branchIds)] : [];
  for (const branchId of ids) {
    io.to(`branch:${branchId}`).emit("menu:availability-changed", { branchId, ...payload });
  }
}
