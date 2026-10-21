"use client";

import { api, ApiError, getApiUrl } from "./api";

export type ApiCapabilities = {
  apiVersion: number;
  dashboardSummary: boolean;
  adminOrdersDispatch: boolean;
  adminTracking: boolean;
};

let cached: ApiCapabilities | null = null;
let inflight: Promise<ApiCapabilities> | null = null;

const LEGACY: ApiCapabilities = {
  apiVersion: 1,
  dashboardSummary: false,
  adminOrdersDispatch: false,
  adminTracking: false,
};

const MODERN: ApiCapabilities = {
  apiVersion: 2,
  dashboardSummary: true,
  adminOrdersDispatch: true,
  adminTracking: true,
};

export function isRouteMissingError(err: unknown) {
  return err instanceof ApiError && err.status === 404 && err.message === "Not found.";
}

export async function loadApiCapabilities(force = false): Promise<ApiCapabilities> {
  if (cached && !force) return cached;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const health = await api<{
        ok?: boolean;
        apiVersion?: number;
        features?: Partial<ApiCapabilities>;
      }>("/health");
      if (health.features && typeof health.apiVersion === "number") {
        cached = {
          apiVersion: health.apiVersion,
          dashboardSummary: Boolean(health.features.dashboardSummary),
          adminOrdersDispatch: Boolean(health.features.adminOrdersDispatch),
          adminTracking: Boolean(health.features.adminTracking),
        };
        return cached;
      }
      cached = health.ok ? MODERN : LEGACY;
      return cached;
    } catch {
      cached = LEGACY;
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getCachedApiCapabilities() {
  return cached;
}

export function apiUpgradeMessage() {
  const target = getApiUrl().startsWith("/") ? "API_PROXY_TARGET on Vercel" : "your API server";
  return `The live API is older than this admin UI. Redeploy the Restaurant-OS backend (latest main), run prisma migrate deploy, and point ${target} at it. Some screens use a limited compatibility mode until then.`;
}
