import crypto from "crypto";
import bcrypt from "bcryptjs";
import { PlanInterval, Role, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { invalidateTenantHostCache } from "../tenant-resolve";

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

export async function provisionTenant(input: ProvisionTenantInput) {
  return withoutTenant("provision tenant", async () => {
    const slug = normalizeTenantSlug(input.slug);
    const displayName = input.displayName.trim();
    if (!displayName) {
      throw Object.assign(new Error("Display name is required."), { status: 400 });
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

    const plan = await basePrisma.plan.findFirst({
      where: { slug: input.planSlug?.trim() || "growth", isActive: true },
    });
    if (!plan) throw Object.assign(new Error("Plan not found."), { status: 400 });

    const trialDays = Math.min(90, Math.max(0, input.trialDays ?? 14));
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + trialDays);
    const periodEnd = addMonths(now, plan.interval);

    const restaurantId = crypto.randomUUID();
    const ownerEmail = input.ownerEmail?.trim().toLowerCase() || "";
    const ownerPassword = input.ownerPassword?.trim() || "";

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
          city: input.city?.trim() || "",
          hostname,
          status: TenantStatus.TRIAL,
          statusChangedAt: now,
        },
      });

      await tx.storeSettings.create({
        data: {
          id: restaurantId,
          restaurantId,
          storeName: displayName,
          timezone: "Asia/Karachi",
          currencyCode: "PKR",
          currencySymbol: "Rs",
        },
      });

      const branch = await tx.branch.create({
        data: {
          restaurantId,
          name: `${displayName} — Main`,
          code: "main",
          address: "",
          phone: input.ownerPhone?.trim() || "",
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

      return { restaurant, branchId: branch.id, ownerUserId, planSlug: plan.slug };
    });

    invalidateTenantHostCache(hostname || undefined);
    invalidateTenantHostCache(slug);
    return result;
  });
}
