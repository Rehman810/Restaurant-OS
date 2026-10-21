import type { Prisma } from "@prisma/client";
import { normalizeBranchCodeInput, suggestBranchCodeFromName, validateBranchCode } from "./code";

const PHONE = /^[+0-9][0-9\s().-]{6,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BranchInputErrors = Record<string, string>;

export function formatBranchAddress(parts: {
  addressLine?: string;
  area?: string;
  city?: string;
}): string {
  return [parts.addressLine, parts.area, parts.city].map((s) => (s || "").trim()).filter(Boolean).join(", ");
}

export function parseBranchCreateBody(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const rawCode = body.code !== undefined && body.code !== null ? String(body.code) : "";
  const code = rawCode ? normalizeBranchCodeInput(rawCode) : suggestBranchCodeFromName(name);
  const addressLine = String(body.addressLine ?? body.address ?? "").trim();
  const area = String(body.area ?? "").trim();
  const city = String(body.city ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = body.email !== undefined && body.email !== null ? String(body.email).trim() : "";
  const latitude = body.latitude;
  const longitude = body.longitude;
  const managerUserId =
    body.managerUserId !== undefined && body.managerUserId !== null ? String(body.managerUserId).trim() : null;
  const acceptsOnlineOrders = body.acceptsOnlineOrders !== false;
  const isDefault = Boolean(body.isDefault);
  const sortOrder = Number(body.sortOrder) || 0;

  return {
    name,
    code,
    addressLine,
    area,
    city,
    address: formatBranchAddress({ addressLine, area, city }),
    phone,
    email: email || null,
    latitude,
    longitude,
    managerUserId: managerUserId || null,
    acceptsOnlineOrders,
    isDefault,
    sortOrder,
  };
}

export function validateBranchFields(
  parsed: ReturnType<typeof parseBranchCreateBody>,
  opts?: { requireName?: boolean }
): BranchInputErrors {
  const errors: BranchInputErrors = {};
  if (opts?.requireName !== false && !parsed.name) {
    errors.name = "Branch name is required.";
  }
  if (parsed.name && parsed.name.length > 120) {
    errors.name = "Name is too long (max 120 characters).";
  }
  const codeErr = validateBranchCode(parsed.code);
  if (codeErr) errors.code = codeErr;
  if (parsed.phone && !PHONE.test(parsed.phone)) {
    errors.phone = "Enter a valid phone number, or leave it blank.";
  }
  if (parsed.email && !EMAIL.test(parsed.email)) {
    errors.email = "Enter a valid email address, or leave it blank.";
  }
  if (parsed.latitude !== undefined && parsed.latitude !== null && parsed.latitude !== "") {
    const lat = Number(parsed.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (parsed.longitude !== undefined && parsed.longitude !== null && parsed.longitude !== "") {
    const lng = Number(parsed.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = "Longitude must be between -180 and 180.";
  }
  return errors;
}

export function branchDataFromParsed(
  parsed: ReturnType<typeof parseBranchCreateBody>
): Prisma.BranchCreateInput {
  const lat =
    parsed.latitude !== undefined && parsed.latitude !== null && parsed.latitude !== ""
      ? Number(parsed.latitude)
      : null;
  const lng =
    parsed.longitude !== undefined && parsed.longitude !== null && parsed.longitude !== ""
      ? Number(parsed.longitude)
      : null;

  return {
    name: parsed.name,
    code: parsed.code,
    address: parsed.address,
    addressLine: parsed.addressLine,
    area: parsed.area,
    city: parsed.city,
    phone: parsed.phone,
    email: parsed.email,
    latitude: lat,
    longitude: lng,
    acceptsOnlineOrders: parsed.acceptsOnlineOrders,
    isDefault: parsed.isDefault,
    sortOrder: parsed.sortOrder,
  };
}
