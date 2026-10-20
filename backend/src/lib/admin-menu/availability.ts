import { SoldOutUntilKind } from "@prisma/client";
import { branchDayRangeUtc } from "../dine-in/branch-time";

export type AvailabilityRow = {
  soldOut: boolean;
  untilKind: SoldOutUntilKind;
  untilAt: Date | null;
  reason: string;
  setById: string | null;
  setAt: Date;
};

export type ResolvedAvailability = {
  state: "available" | "soldOut";
  reason: string | null;
  until: string | null;
  untilKind: SoldOutUntilKind | null;
};

function isOverrideExpired(row: AvailabilityRow, timezone: string, now = new Date()): boolean {
  if (!row.soldOut) return true;
  if (row.untilKind === SoldOutUntilKind.INDEFINITE) return false;
  if (row.untilKind === SoldOutUntilKind.END_OF_STORE_DAY) {
    const { endUtc } = branchDayRangeUtc(timezone, now);
    return now.getTime() > endUtc.getTime();
  }
  if (row.untilKind === SoldOutUntilKind.DATETIME && row.untilAt) {
    return now.getTime() > row.untilAt.getTime();
  }
  return false;
}

/** Sold-out overrides are evaluated at read time; expired rows are treated as available. */
export function resolveAvailability(
  override: AvailabilityRow | null | undefined,
  timezone: string,
  legacyGlobalUnavailable = false,
  now = new Date()
): ResolvedAvailability {
  if (override?.soldOut && !isOverrideExpired(override, timezone, now)) {
    return {
      state: "soldOut",
      reason: override.reason || null,
      until:
        override.untilKind === SoldOutUntilKind.DATETIME && override.untilAt
          ? override.untilAt.toISOString()
          : override.untilKind === SoldOutUntilKind.END_OF_STORE_DAY
            ? "endOfDay"
            : null,
      untilKind: override.untilKind,
    };
  }
  if (legacyGlobalUnavailable) {
    return { state: "soldOut", reason: "legacy", until: null, untilKind: null };
  }
  return { state: "available", reason: null, until: null, untilKind: null };
}

export function isOrderableAvailability(resolved: ResolvedAvailability, visible: boolean, archived: boolean): boolean {
  if (archived || !visible) return false;
  return resolved.state === "available";
}

export type SoldOutPatchInput = {
  state: "available" | "soldOut";
  until?: null | "endOfDay" | string;
};

export function soldOutPatchToRow(
  input: SoldOutPatchInput,
  timezone: string,
  now = new Date()
): Pick<AvailabilityRow, "soldOut" | "untilKind" | "untilAt"> {
  if (input.state === "available") {
    return { soldOut: false, untilKind: SoldOutUntilKind.INDEFINITE, untilAt: null };
  }
  if (input.until === "endOfDay") {
    const { endUtc } = branchDayRangeUtc(timezone, now);
    return { soldOut: true, untilKind: SoldOutUntilKind.END_OF_STORE_DAY, untilAt: endUtc };
  }
  if (input.until && input.until !== "endOfDay") {
    const dt = new Date(input.until);
    if (!Number.isNaN(dt.getTime())) {
      return { soldOut: true, untilKind: SoldOutUntilKind.DATETIME, untilAt: dt };
    }
  }
  return { soldOut: true, untilKind: SoldOutUntilKind.INDEFINITE, untilAt: null };
}
