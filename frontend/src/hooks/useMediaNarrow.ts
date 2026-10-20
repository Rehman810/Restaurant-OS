"use client";

import { useEffect, useState } from "react";

/** True when viewport is phone-sized (kitchen lane tabs). */
export function useMediaNarrow(maxPx = 767) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxPx]);

  return narrow;
}
