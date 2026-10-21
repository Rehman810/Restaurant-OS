"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { api, SOCKET_URL } from "@/lib/api";

let socket: Socket | null = null;
let socketTokenPromise: Promise<string> | null = null;

async function fetchSocketToken() {
  if (!socketTokenPromise) {
    socketTokenPromise = api<{ token: string }>("/auth/socket-token")
      .then((r) => r.token)
      .catch(() => "");
  }
  return socketTokenPromise;
}

async function ensureSocket(): Promise<Socket | null> {
  if (!SOCKET_URL) return null;
  if (socket?.connected) return socket;
  const token = await fetchSocketToken();
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: token ? { token } : {},
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
    });
  } else if (token) {
    socket.auth = { token };
    socket.connect();
  }
  return socket;
}

export type OpsNotificationEvent = {
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

export type LiveOrdersOptions = {
  onCreated?: (payload?: { orderId?: string; at?: number }) => void;
  onConnectChange?: (connected: boolean) => void;
  onKitchenAlert?: (payload: { type: string; orderId: string; orderNumber: string; message: string; at: number }) => void;
  onOpsNotification?: (payload: OpsNotificationEvent) => void;
  onMenuCatalogChanged?: () => void;
  onMenuAvailabilityChanged?: (payload: { branchId: string; at: number }) => void;
};

export function useLiveOrders(
  onChange: () => void,
  orderId?: string,
  guestToken?: string | null,
  options?: LiveOrdersOptions
) {
  const onChangeRef = useRef(onChange);
  const optionsRef = useRef(options);
  onChangeRef.current = onChange;
  optionsRef.current = options;

  useEffect(() => {
    let s: Socket | null = null;
    const onConnect = () => optionsRef.current?.onConnectChange?.(true);
    const onDisconnect = () => optionsRef.current?.onConnectChange?.(false);
    const onUpdated = () => onChangeRef.current();
    const onCreated = (payload?: { orderId?: string; at?: number }) => {
      optionsRef.current?.onCreated?.(payload);
      onChangeRef.current();
    };
    const onKitchenAlert = (payload: {
      type: string;
      orderId: string;
      orderNumber: string;
      message: string;
      at: number;
    }) => {
      optionsRef.current?.onKitchenAlert?.(payload);
    };
    const onOpsNotification = (payload: OpsNotificationEvent) => {
      optionsRef.current?.onOpsNotification?.(payload);
    };
    const onMenuCatalogChanged = () => optionsRef.current?.onMenuCatalogChanged?.();
    const onMenuAvailabilityChanged = (payload: { branchId: string; at: number }) => {
      optionsRef.current?.onMenuAvailabilityChanged?.(payload);
    };
    const onBoardDelta = () => onChangeRef.current();
    void ensureSocket().then((sock) => {
      s = sock;
      if (!s) {
        optionsRef.current?.onConnectChange?.(false);
        return;
      }
      s.on("order:created", onCreated);
      s.on("order:updated", onUpdated);
      s.on("tracking:board-delta", onBoardDelta);
      s.on("kitchen:alert", onKitchenAlert);
      s.on("ops:notification", onOpsNotification);
      s.on("menu:catalog-changed", onMenuCatalogChanged);
      s.on("menu:availability-changed", onMenuAvailabilityChanged);
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      optionsRef.current?.onConnectChange?.(s.connected);
      if (orderId) {
        s.emit("watch-order", guestToken ? { orderId, token: guestToken } : orderId);
      }
    });
    return () => {
      if (!s) return;
      s.off("order:created", onCreated);
      s.off("order:updated", onUpdated);
      s.off("tracking:board-delta", onBoardDelta);
      s.off("kitchen:alert", onKitchenAlert);
      s.off("ops:notification", onOpsNotification);
      s.off("menu:catalog-changed", onMenuCatalogChanged);
      s.off("menu:availability-changed", onMenuAvailabilityChanged);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [orderId, guestToken]);
}

export function reconnectLiveSocket() {
  socketTokenPromise = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  void ensureSocket();
}
