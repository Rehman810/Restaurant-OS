import { getRestaurantId } from "./restaurant-context";

function rid(explicit?: string) {
  return explicit || getRestaurantId();
}

export function tenantOpsRoom(restaurantId?: string) {
  return `t:${rid(restaurantId)}:ops`;
}

export function tenantBranchRoom(branchId: string, restaurantId?: string) {
  return `t:${rid(restaurantId)}:b:${branchId}`;
}

export function tenantRiderRoom(userId: string, restaurantId?: string) {
  return `t:${rid(restaurantId)}:rider:${userId}`;
}

export function tenantCustomerRoom(userId: string, restaurantId?: string) {
  return `t:${rid(restaurantId)}:customer:${userId}`;
}

export function tenantUserRoom(userId: string, restaurantId?: string) {
  return `t:${rid(restaurantId)}:user:${userId}`;
}

export function tenantOrderRoom(orderId: string, restaurantId?: string) {
  return `t:${rid(restaurantId)}:order:${orderId}`;
}

/** Storefront and anonymous sockets (menu and delivery refresh). */
export function tenantPublicRoom(restaurantId?: string) {
  return `t:${rid(restaurantId)}:public`;
}
