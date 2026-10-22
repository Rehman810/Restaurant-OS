import { readCsrfFromDocument } from "./csrf";

export function getApiUrl() {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    return "/api/proxy";
  }
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return "/api/proxy";
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildHeaders(options: RequestInit, jsonBody: boolean) {
  const headers: Record<string, string> = {
    ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const method = (options.method || "GET").toUpperCase();
  if (MUTATING.has(method)) {
    const csrf = getPlatformCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const platformPath = normalized.startsWith("/platform") ? normalized : `/platform${normalized}`;
  const jsonBody = Boolean(options.body && typeof options.body === "string");
  const res = await fetch(`${getApiUrl()}${platformPath}`, {
    ...options,
    headers: buildHeaders(options, jsonBody),
    credentials: "include",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* plain text */
  }
  if (!res.ok) {
    const err = body as { error?: string; code?: string };
    throw new ApiError(err?.error || "Request failed", res.status, err?.code);
  }
  return body as T;
}

let cachedCsrf = "";

export function getPlatformCsrfToken() {
  return cachedCsrf || readCsrfFromDocument();
}

export async function ensurePlatformCsrf() {
  const res = await api<{ csrfToken?: string }>("/auth/csrf");
  if (res.csrfToken) cachedCsrf = res.csrfToken;
}

