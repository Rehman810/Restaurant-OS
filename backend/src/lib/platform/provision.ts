import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PlanInterval, Prisma, Role, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { invalidateTenantHostCache } from "../tenant-resolve";
import {
  defaultWeeklyScheduleJson,
  seedDeliveryAreasForTenant,
  seedStarterMenuForTenant,
} from "./provision-seeds";
import { DEFAULT_PLATFORM_TRIAL_DAYS, loadPlatformSettings } from "./platform-settings";

export type ProvisionTenantInput = {
  slug: string;
  displayName: string;
  legalName?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  city?: string;
  hostname?: string | null;
  planSlug?: string;
  trialDays?: number;
  ownerPassword?: string;
  isTest?: boolean;
  storeTagline?: string;
  timezone?: string;
  currencyCode?: string;
  currencySymbol?: string;
  storePhone?: string;
  whatsapp?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  minimumOrder?: number;
  taxEnabled?: boolean;
  taxPercent?: number;
  branchAddressLine?: string;
  branchArea?: string;
  branchCity?: string;
  acceptsOnlineOrders?: boolean;
  seedDeliveryAreas?: boolean;
  seedStarterMenu?: boolean;
  /** City used for delivery-area templates when `city` is empty but seeding is on */
  seedCity?: string;
};

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  lahore: { latitude: 31.5204, longitude: 74.3587 },
  karachi: { latitude: 24.8607, longitude: 67.0011 },
  islamabad: { latitude: 33.6844, longitude: 73.0479 },
};

export function normalizeTenantSlug(raw: string) {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length < 2) {
    throw Object.assign(new Error("Choose a store URL slug with at least 2 letters or numbers."), { status: 400 });
  }
  return slug;
}

function addMonths(start: Date, interval: PlanInterval) {
  const end = new Date(start);
  if (interval === PlanInterval.YEARLY) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end;
}

function coordsForCity(city: string, lat?: number, lng?: number) {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  const key = city.trim().toLowerCase();
  const hit = CITY_COORDS[key];
  if (!hit) return { latitude: lat ?? null, longitude: lng ?? null };
  return { latitude: lat ?? hit.latitude, longitude: lng ?? hit.longitude };
}

export async function provisionTenant(input: ProvisionTenantInput) {
  return withoutTenant("provision tenant", async () => {
    const slug = normalizeTenantSlug(input.slug);
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw Object.assign(new Error("Display name is required."), { status: 400 });
    }

    const ownerEmail = input.ownerEmail?.trim().toLowerCase() || "";
    const ownerPassword = input.ownerPassword?.trim() || "";
    if (ownerEmail && ownerPassword.length < 12) {
      throw Object.assign(new Error("Owner password must be at least 12 characters."), { status: 400 });
    }

    const existingSlug = await basePrisma.restaurant.findFirst({ where: { slug }, select: { id: true } });
    if (existingSlug) {
      throw Object.assign(new Error("That store URL is already taken."), { status: 409, code: "SLUG_TAKEN" });
    }

    const hostname =
      input.hostname?.trim().toLowerCase() ||
      (process.env.NODE_ENV !== "production" ? `${slug}.localhost` : null);
    if (hostname) {
      const hostTaken =
        (await basePrisma.restaurant.findFirst({ where: { hostname }, select: { id: true } })) ||
        (await basePrisma.tenantDomain.findFirst({ where: { hostname }, select: { id: true } }));
      if (hostTaken) {
        throw Object.assign(new Error("That hostname is already in use."), { status: 409, code: "HOST_TAKEN" });
      }
    }

    const platformDefaults = await loadPlatformSettings();
    const defaultPlanSlug = platformDefaults.data.defaultPlanSlug?.trim() || "growth";
    const defaultTrialDays = platformDefaults.data.trialDays ?? DEFAULT_PLATFORM_TRIAL_DAYS;

    const plan = await basePrisma.plan.findFirst({
      where: { slug: input.planSlug?.trim() || defaultPlanSlug, isActive: true },
    });
    if (!plan) throw Object.assign(new Error("Plan not found."), { status: 400 });

    const trialDays = Math.min(90, Math.max(0, input.trialDays ?? defaultTrialDays));
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + trialDays);
    const periodEnd = addMonths(now, plan.interval);

    const restaurantId = crypto.randomUUID();
    const city = input.city?.trim() || "";
    const branchCity = input.branchCity?.trim() || city;
    const timezone = input.timezone?.trim() || "Asia/Karachi";
    const currencyCode = input.currencyCode?.trim().toUpperCase() || "PKR";
    const currencySymbol = input.currencySymbol?.trim() || "Rs";
    const storePhone = input.storePhone?.trim() || input.ownerPhone?.trim() || "";
    const address = input.address?.trim() || "";
    const coords = coordsForCity(branchCity || city, input.latitude, input.longitude);

    const settingsData: Prisma.StoreSettingsUncheckedCreateInput = {
      id: restaurantId,
      restaurantId,
      storeName: displayName,
      storeTagline: input.storeTagline?.trim() || "Order in minutes",
      timezone,
      currencyCode,
      currencySymbol,
      city: branchCity || city,
      phone: storePhone,
      whatsapp: input.whatsapp?.trim() || storePhone,
      address,
      weeklySchedule: defaultWeeklyScheduleJson(),
      openHour: 12,
      openMinute: 0,
      closeHour: 1,
      closeMinute: 30,
      ...(coords.latitude != null && coords.longitude != null
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : {}),
      ...(input.minimumOrder != null && input.minimumOrder >= 0
        ? { minimumOrder: input.minimumOrder }
        : {}),
      ...(input.taxEnabled
        ? {
            taxEnabled: true,
            taxPercent: input.taxPercent != null ? input.taxPercent : 0,
          }
        : {}),
    };

    const branchAddressLine = input.branchAddressLine?.trim() || address;
    const branchPhone = storePhone || input.ownerPhone?.trim() || "";

    const result = await basePrisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          id: restaurantId,
          slug,
          displayName,
          legalName: input.legalName?.trim() || displayName,
          ownerName: input.ownerName?.trim() || "",
          ownerEmail,
          ownerPhone: input.ownerPhone?.trim() || "",
          city: branchCity || city,
          hostname,
          isTest: Boolean(input.isTest),
          status: TenantStatus.TRIAL,
          statusChangedAt: now,
        },
      });

      await tx.storeSettings.create({ data: settingsData });

      const branch = await tx.branch.create({
        data: {
          restaurantId,
          name: `${displayName} — Main`,
          code: "main",
          address: branchAddressLine,
          addressLine: branchAddressLine,
          area: input.branchArea?.trim() || "",
          city: branchCity,
          phone: branchPhone,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timezone,
          acceptsOnlineOrders: input.acceptsOnlineOrders !== false,
          isDefault: true,
          isActive: true,
          sortOrder: 0,
        },
      });

      await tx.subscription.create({
        data: {
          restaurantId,
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      if (hostname) {
        await tx.tenantDomain.create({
          data: {
            restaurantId,
            hostname,
            isPrimary: true,
            verifiedAt: now,
          },
        });
      }

      let ownerUserId: string | null = null;
      if (ownerEmail && ownerPassword) {
        const passwordHash = await bcrypt.hash(ownerPassword, 12);
        const owner = await tx.user.create({
          data: {
            restaurantId,
            name: input.ownerName?.trim() || "Owner",
            email: ownerEmail,
            passwordHash,
            role: Role.ADMIN,
            isActive: true,
            isOwner: true,
          },
        });
        ownerUserId = owner.id;
        await tx.branchMember.create({
          data: { branchId: branch.id, userId: owner.id },
        });
      }

      const seedCity = input.seedCity?.trim() || branchCity || city;
      let deliveryAreasSeeded = 0;
      if (input.seedDeliveryAreas && seedCity) {
        deliveryAreasSeeded = await seedDeliveryAreasForTenant(tx, {
          restaurantId,
          branchId: branch.id,
          city: seedCity,
        });
      }

      let starterMenu: { categories: number; items: number } | null = null;
      if (input.seedStarterMenu) {
        starterMenu = await seedStarterMenuForTenant(tx, restaurantId);
      }

      return {
        restaurant,
        branchId: branch.id,
        ownerUserId,
        planSlug: plan.slug,
        deliveryAreasSeeded,
        starterMenu,
      };
    });

    invalidateTenantHostCache(hostname || undefined);
    invalidateTenantHostCache(slug);
    return result;
  });
}
