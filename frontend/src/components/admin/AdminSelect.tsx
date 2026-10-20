"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { OrderStatus } from "@/lib/types";
import { STATUS_THEME } from "@/lib/admin-status";

export type AdminSelectOption = {
  value: string;
  label: string;
  status?: OrderStatus;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  minWidth?: string;
  "aria-label"?: string;
};

export function AdminSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  className = "",
  minWidth = "min-w-[148px]",
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    placement: "bottom" | "top";
    top?: number;
    bottom?: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;
  const selectedTheme = selected?.status ? STATUS_THEME[selected.status] : null;

  const MENU_GAP = 6;
  const VIEWPORT_PAD = 12;
  const PREFERRED_MAX = 280;

  function updateMenuPosition() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;

    const spaceBelow = viewportH - rect.bottom - MENU_GAP - VIEWPORT_PAD;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_PAD;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

    const maxHeight = Math.min(
      PREFERRED_MAX,
      Math.max(120, openUp ? spaceAbove : spaceBelow)
    );

    setMenuRect({
      left: rect.left,
      width: Math.max(rect.width, 200),
      maxHeight,
      placement: openUp ? "top" : "bottom",
      ...(openUp
        ? { bottom: viewportH - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-admin-select-menu]")) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function pick(next: string) {
    const opt = options.find((o) => o.value === next);
    if (opt?.disabled) return;
    onChange(next);
    setOpen(false);
  }

  const menu =
    open && menuRect
      ? (
          <ul
            data-admin-select-menu
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: menuRect.maxHeight,
              zIndex: 10050,
              ...(menuRect.placement === "top"
                ? { bottom: menuRect.bottom }
                : { top: menuRect.top }),
            }}
            className="overflow-y-auto overscroll-contain rounded-xl border border-stone-200/80 bg-white p-1.5 shadow-2xl shadow-stone-900/15 ring-1 ring-stone-900/5 dark:border-stone-600 dark:bg-stone-900 dark:ring-stone-700"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              const theme = opt.status ? STATUS_THEME[opt.status] : null;
              return (
                <li key={opt.value || "__empty"} role="option" aria-selected={active} aria-disabled={opt.disabled}>
                  <button
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => pick(opt.value)}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      opt.disabled
                        ? "cursor-not-allowed text-stone-300"
                        : active
                          ? "bg-brand-50 text-brand-900 dark:bg-brand-950/50 dark:text-brand-100"
                          : "text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {theme && (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${opt.disabled ? "bg-stone-200" : theme.dot}`} />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {active && !opt.disabled ? (
                      <Check size={14} className="shrink-0 text-brand-600" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${minWidth} ${className}`}>
      {label && (
        <p className="mb-1 text-xs font-medium text-stone-500">{label}</p>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white py-2.5 pl-3 pr-2.5 text-left text-sm font-semibold shadow-sm outline-none transition dark:bg-stone-900 ${
          open
            ? "border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900"
            : "border-stone-200 hover:border-stone-300 hover:shadow dark:border-stone-600"
        } ${selected ? "text-stone-800 dark:text-stone-100" : "text-stone-400"}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedTheme && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${selectedTheme.dot}`} />
          )}
          <span className="truncate">{display}</span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {typeof document !== "undefined" && menu && createPortal(menu, document.body)}
    </div>
  );
}
