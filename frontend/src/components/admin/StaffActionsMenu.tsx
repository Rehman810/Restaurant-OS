"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, LogOut, MapPin, MoreHorizontal, ShieldOff, UserPen, Users } from "lucide-react";
import { User } from "@/lib/types";
import type { StaffListRow } from "@/modules/staff/types";
import { canShowStaffAction } from "@/modules/staff/helpers";

export type StaffAction =
  | "edit"
  | "role"
  | "branches"
  | "resetPassword"
  | "reset2fa"
  | "pin"
  | "sessions"
  | "deactivate"
  | "reactivate";

const ITEMS: { id: StaffAction; label: string; icon: typeof UserPen; danger?: boolean }[] = [
  { id: "edit", label: "Edit", icon: UserPen },
  { id: "role", label: "Change role", icon: Users },
  { id: "branches", label: "Branches", icon: MapPin },
  { id: "resetPassword", label: "Reset password", icon: KeyRound },
  { id: "reset2fa", label: "Reset 2FA", icon: ShieldOff },
  { id: "pin", label: "Set POS PIN", icon: KeyRound },
  { id: "sessions", label: "Sessions", icon: LogOut },
  { id: "deactivate", label: "Deactivate", icon: ShieldOff, danger: true },
  { id: "reactivate", label: "Reactivate", icon: Users },
];

export function StaffActionsMenu({
  member,
  actor,
  disabled,
  onAction,
}: {
  member: StaffListRow;
  actor: User | null;
  disabled?: boolean;
  onAction: (action: StaffAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    function update() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const visible = ITEMS.filter((item) => {
    if (item.id === "deactivate" && !member.isActive) return false;
    if (item.id === "reactivate" && member.isActive) return false;
    return canShowStaffAction(actor, item.id, member);
  });

  if (!visible.length) return null;

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={`Actions for ${member.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[80]"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              className="fixed z-[81] min-w-[11rem] rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-600 dark:bg-stone-900"
              style={{ top: pos.top, right: pos.right }}
            >
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`flex min-h-10 w-full items-center gap-2 px-3 text-left text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 ${
                    item.danger
                      ? "text-red-600 dark:text-red-400"
                      : "text-stone-800 dark:text-stone-100"
                  }`}
                  onClick={() => {
                    setOpen(false);
                    onAction(item.id);
                  }}
                >
                  <item.icon size={16} className="shrink-0 text-stone-500" aria-hidden />
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
