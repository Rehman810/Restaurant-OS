"use client";

import { useEffect } from "react";
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
    });
  } else if (token) {
    socket.auth = { token };
    socket.connect();
  }
  return socket;
}

export type LiveOrdersOptions = {
  onCreated?: () => void;
  onConnectChange?: (connected: boolean) => void;
};

export function useLiveOrders(
  onChange: () => void,
  orderId?: string,
  guestToken?: string | null,
  options?: LiveOrdersOptions
) {
  useEffect(() => {
    let s: Socket | null = null;
    const onConnect = () => options?.onConnectChange?.(true);
    const onDisconnect = () => options?.onConnectChange?.(false);
    const onUpdated = () => onChange();
    const onCreated = () => {
      options?.onCreated?.();
      onChange();
    };
    void ensureSocket().then((sock) => {
      s = sock;
      if (!s) {
        options?.onConnectChange?.(false);
        return;
      }
      s.on("order:created", onCreated);
      s.on("order:updated", onUpdated);
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      options?.onConnectChange?.(s.connected);
      if (orderId) {
        s.emit("watch-order", guestToken ? { orderId, token: guestToken } : orderId);
      }
    });
    return () => {
      if (!s) return;
      s.off("order:created", onCreated);
      s.off("order:updated", onUpdated);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [onChange, orderId, guestToken, options]);
}

export function reconnectLiveSocket() {
  socketTokenPromise = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  void ensureSocket();
}
