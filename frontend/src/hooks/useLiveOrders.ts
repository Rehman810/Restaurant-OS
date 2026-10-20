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

export type LiveOrdersOptions = {
  onCreated?: (payload?: { orderId?: string; at?: number }) => void;
  onConnectChange?: (connected: boolean) => void;
  onKitchenAlert?: (payload: { type: string; orderId: string; orderNumber: string; message: string; at: number }) => void;
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
    void ensureSocket().then((sock) => {
      s = sock;
      if (!s) {
        optionsRef.current?.onConnectChange?.(false);
        return;
      }
      s.on("order:created", onCreated);
      s.on("order:updated", onUpdated);
      s.on("kitchen:alert", onKitchenAlert);
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
      s.off("kitchen:alert", onKitchenAlert);
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
