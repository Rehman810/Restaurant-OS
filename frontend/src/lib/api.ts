// Production (Vercel): use same-origin proxy — avoids CORS & dead Cloudflare tunnel URLs.
// Set API_PROXY_TARGET=http://YOUR_ORACLE_IP:4000 on Vercel (server env).
// Optional: NEXT_PUBLIC_API_URL=https://your-https-api.com for direct API + websockets.
import { readCsrfFromDocument } from "./csrf";

function isLocalApiUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** REST base URL. In the browser during dev, same-origin `/api/proxy` avoids broken `localhost` when using port-forwarding. */
export function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    if (!configured || isLocalApiUrl(configured)) {
      return "/api/proxy";
    }
  }
  if (configured) {
    if (process.env.NODE_ENV === "production" && isLocalApiUrl(configured)) {
      return "/api/proxy";
    }
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "/api/proxy" : "http://localhost:4000";
}

/** @deprecated Prefer getApiUrl() in fetch calls; may be wrong in the browser at module load. */
export const API_URL = getApiUrl();

/** Socket.io needs a real host — set NEXT_PUBLIC_SOCKET_URL when REST uses /api/proxy. */
export function getSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (api && !api.startsWith("/") && !isLocalApiUrl(api)) return api;
  return "http://localhost:4000";
}

export const SOCKET_URL = getSocketUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildHeaders(options: RequestInit, jsonBody: boolean) {
  const branch =
    typeof window !== "undefined" ? localStorage.getItem("uff-admin-branch") || undefined : undefined;
  const headers: Record<string, string> = {
    ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const method = (options.method || "GET").toUpperCase();
  if (MUTATING.has(method)) {
    const csrf = readCsrfFromDocument();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (branch) headers["X-Branch-Id"] = branch;
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const jsonBody = Boolean(options.body && typeof options.body === "string");
  const headers = buildHeaders(options, jsonBody);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...options, headers, credentials: "include", signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Server took too long to respond. Is the API running?", 0);
    }
    throw new ApiError("Cannot reach API. Start the backend or check NEXT_PUBLIC_API_URL.", 0);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export async function apiUpload(path: string, file: File): Promise<{ url: string }> {
  const body = new FormData();
  body.append("image", file);
  const csrf = readCsrfFromDocument();

  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: csrf ? { "X-CSRF-Token": csrf } : {},
    credentials: "include",
    body,
  });

  if (!res.ok) {
    let message = "Upload failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<{ url: string }>;
}

export function invoiceUrl(orderId: string, guestToken?: string | null) {
  const base = `${getApiUrl()}/invoices/${orderId}/download`;
  if (!guestToken) return base;
  return `${base}?token=${encodeURIComponent(guestToken)}`;
}

export async function downloadInvoice(orderId: string, guestToken?: string | null) {
  const res = await fetch(invoiceUrl(orderId, guestToken), { credentials: "include" });
  if (!res.ok) throw new Error("Could not download invoice");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${orderId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
