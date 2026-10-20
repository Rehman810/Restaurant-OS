import { describe, expect, it } from "vitest";
import { ACCESS_MATRIX, canAccess, type AccessAction, type AppRole } from "../src/lib/access";
import { sniffImage } from "../src/lib/image-sniff";
import { isLocked, LOGIN_FAIL_LIMIT, nextLockState } from "../src/lib/login-guard";
import { createRecoveryCodes, matchRecoveryCode } from "../src/lib/recovery-codes";
import { clearSessionCookie, sessionCookie } from "../src/lib/session-cookie";
import { cleanText } from "../src/lib/text";

describe("security helpers", () => {
  it("[SEC-03] locks the account after repeated failures", () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    let count = 0;
    let locked: Date | null = null;
    for (let i = 0; i < LOGIN_FAIL_LIMIT - 1; i += 1) {
      const next = nextLockState(count, now);
      count = next.failedLoginCount;
      locked = next.lockedUntil;
      expect(isLocked(locked, now)).toBe(false);
    }
    const lockedState = nextLockState(count, now);
    expect(isLocked(lockedState.lockedUntil, now)).toBe(true);
    expect(isLocked(lockedState.lockedUntil, new Date(now.getTime() + 16 * 60 * 1000))).toBe(false);
  });

  it("[SEC-04] a recovery code works once", () => {
    const { plain, stored } = createRecoveryCodes(2);
    const first = matchRecoveryCode(stored, plain[0]);
    expect(first.ok).toBe(true);
    const again = matchRecoveryCode(first.remaining, plain[0]);
    expect(again.ok).toBe(false);
    expect(matchRecoveryCode(first.remaining, plain[1]).ok).toBe(true);
    expect(matchRecoveryCode(stored, "0000-0000").ok).toBe(false);
  });

  it("[SEC-05] role matrix matches cashier, chef, rider, and admin", () => {
    const roles: AppRole[] = ["ADMIN", "CASHIER", "CHEF", "RIDER", "CUSTOMER", "ANONYMOUS"];
    for (const action of Object.keys(ACCESS_MATRIX) as AccessAction[]) {
      for (const role of roles) {
        expect(canAccess(role, action)).toBe(ACCESS_MATRIX[action].includes(role));
      }
    }
    expect(canAccess("CASHIER", "pos")).toBe(true);
    expect(canAccess("CASHIER", "orders.status")).toBe(true);
    expect(canAccess("CASHIER", "kitchen")).toBe(true);
    expect(canAccess("CASHIER", "customers.read")).toBe(true);
    expect(canAccess("CASHIER", "settings")).toBe(false);
    expect(canAccess("CHEF", "kitchen")).toBe(true);
    expect(canAccess("CHEF", "dashboard")).toBe(false);
    expect(canAccess("CHEF", "analytics")).toBe(false);
    expect(canAccess("CHEF", "pos")).toBe(false);
    expect(canAccess("RIDER", "rider.own")).toBe(true);
    expect(canAccess("RIDER", "orders.read")).toBe(false);
    expect(canAccess("ANONYMOUS", "settings")).toBe(false);
  });

  it("[SEC-08] strips markup from notes and names", () => {
    expect(cleanText("<script>alert(1)</script>extra")).toBe("alert(1)extra");
    expect(cleanText("a<b>c")).toBe("ac");
  });

  it("[SEC-09] rejects a file that is not an image", () => {
    expect(sniffImage(Buffer.from("not an image"))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpeg");
  });

  it("sets httpOnly session cookie flags", () => {
    const header = sessionCookie("abc", true);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
    expect(clearSessionCookie(false)).not.toContain("Secure");
  });
});
