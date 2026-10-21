import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  notificationMatrixCell,
  staffRolesForNewOrderEmail,
} from "../src/lib/notification-email-matrix";
import type { StoreSettings } from "@prisma/client";

function settings(partial: Partial<StoreSettings>): StoreSettings {
  return {
    emailNotifyAdmin: true,
    emailNotifyManager: false,
    emailNotifyChef: true,
    emailNotifyCashier: false,
    emailNotifyWaiter: false,
    emailNotifyRider: true,
    emailNotifyCustomer: false,
    ...partial,
  } as StoreSettings;
}

describe("notification email matrix", () => {
  it("maps staff new-order row to role toggles", () => {
    const s = settings({});
    expect(notificationMatrixCell("staff_new_order", "admin", s)).toBe("on");
    expect(notificationMatrixCell("staff_new_order", "manager", s)).toBe("off");
    expect(notificationMatrixCell("staff_new_order", "rider", s)).toBe("na");
    expect(staffRolesForNewOrderEmail(s)).toEqual([Role.ADMIN, Role.CHEF]);
  });

  it("maps customer lifecycle to customer toggle", () => {
    const s = settings({ emailNotifyCustomer: true });
    expect(notificationMatrixCell("customer_preparing", "customer", s)).toBe("on");
    expect(notificationMatrixCell("customer_preparing", "chef", s)).toBe("na");
  });

  it("does not map transactional account emails to role toggles", () => {
    const s = settings({});
    expect(notificationMatrixCell("account_password_reset", "customer", s)).toBe("na");
    expect(notificationMatrixCell("account_staff_welcome", "admin", s)).toBe("na");
  });
});
