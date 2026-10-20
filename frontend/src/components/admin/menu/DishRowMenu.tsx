"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, MoreHorizontal, Pencil, Archive, Trash2 } from "lucide-react";

type Props = {
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canDelete: boolean;
};

export function DishRowMenu({ onEdit, onDuplicate, onArchive, onDelete, canDelete }: Props) {
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

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-label="Dish actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 text-stone-700 dark:border-stone-600 dark:text-stone-200"
      >
        <MoreHorizontal size={18} />
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <Pencil size={16} /> Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDuplicate();
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <Copy size={16} /> Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onArchive();
                }}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <Archive size={16} /> Archive
              </button>
              {canDelete && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
