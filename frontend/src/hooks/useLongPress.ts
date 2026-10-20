"use client";

import { useCallback, useRef, type PointerEvent } from "react";

/** Clicks on nested controls should not trigger the card's tap / long-press / drag handlers. */
export function isNestedInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("button, a, input, select, textarea, [role='button'], [data-drag-handle]")
  );
}

export function useLongPress({
  onClick,
  onLongPress,
  delayMs = 500,
}: {
  onClick: () => void;
  onLongPress: () => void;
  delayMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (isNestedInteractive(e.target)) return;
      longFired.current = false;
      clear();
      timer.current = setTimeout(() => {
        longFired.current = true;
        onLongPress();
      }, delayMs);
    },
    onPointerUp: (e: PointerEvent) => {
      if (isNestedInteractive(e.target)) return;
      clear();
      if (!longFired.current) onClick();
    },
    onPointerLeave: () => clear(),
    onPointerCancel: () => clear(),
  };

  return { handlers };
}
