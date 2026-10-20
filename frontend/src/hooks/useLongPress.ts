"use client";

import { useCallback, useRef } from "react";

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
    onPointerDown: () => {
      longFired.current = false;
      clear();
      timer.current = setTimeout(() => {
        longFired.current = true;
        onLongPress();
      }, delayMs);
    },
    onPointerUp: () => {
      clear();
      if (!longFired.current) onClick();
    },
    onPointerLeave: () => clear(),
    onPointerCancel: () => clear(),
  };

  return { handlers };
}
