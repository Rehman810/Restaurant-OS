"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, MoreHorizontal, ShieldOff } from "lucide-react";

export function CustomerRowMenu({
  isAdmin,
  blocked,
  onBlock,
  onUnblock,
}: {
  isAdmin: boolean;
  blocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
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

  if (!isAdmin) return null;

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-label="Customer actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
      >
        <MoreHorizontal size={16} />
      </button>
      {open &&
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
              {!blocked ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onBlock();
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Ban size={16} /> Block customer
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onUnblock();
                  }}
                  className="flex min-h-10 w-full items-center gap-2 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  <ShieldOff size={16} /> Unblock
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
