import { TenantStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { tenantAccessForStatus } from "./platform/tenant-lifecycle";
import { DEFAULT_RESTAURANT_ID, getRestaurantId } from "./restaurant-context";
import { isStoreOpen, publicClosedMessage, publicHoursLabel } from "./store-settings";

const MIN_ORDERS_FOR_LIVE_STATS = 10;

export async function getStoreSettings() {
  const restaurantId = getRestaurantId();
  const existing = await prisma.storeSettings.findFirst({ where: { restaurantId } });
  if (existing) return existing;
  return prisma.storeSettings.create({
    data: {
      id: restaurantId === DEFAULT_RESTAURANT_ID ? "default" : restaurantId,
      restaurantId,
    },
  });
}

export async function getPublicStorePayload() {
  const settings = await getStoreSettings();
  const tenant = await prisma.restaurant.findFirst({
    select: { status: true, statusReason: true },
  });
  const access = tenantAccessForStatus(tenant?.status ?? TenantStatus.ACTIVE, tenant?.statusReason ?? "");
  const [banners, areaCount, testimonials, orderCount] = await Promise.all([
    prisma.promoBanner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.deliveryArea.count({ where: { isDelivering: true } }),
    prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.order.count({ where: { status: { not: "CANCELLED" } } }),
  ]);
  const avgRating = testimonials.length
    ? testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length
    : null;
  const showLiveStats = Boolean(settings.showLiveStats) && orderCount >= MIN_ORDERS_FOR_LIVE_STATS;
  const showReviews = Boolean(settings.showReviewsSection);
  const open = isStoreOpen(settings);
  const visibleTestimonials = showReviews ? testimonials : [];
  return {
    settings,
    banners,
    testimonials: visibleTestimonials,
    areaCount,
    highlights:
      showReviews && (showLiveStats || visibleTestimonials.length > 0)
        ? {
            show: true,
            rating: visibleTestimonials.length ? avgRating : null,
            orderCount: showLiveStats ? orderCount : null,
            areaCount,
          }
        : { show: false, rating: null, orderCount: null, areaCount },
    isOpen: open,
    hoursLabel: publicHoursLabel(settings),
    closedMessage: publicClosedMessage(settings),
    storeAccess: {
      status: access.status,
      orderingEnabled: access.allowStorefrontOrders,
      message: access.publicMessage,
      readOnlyAdmin: access.adminReadOnly,
    },
  };
}
