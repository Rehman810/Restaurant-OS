import { ReactNode } from "react";

/** Opaque strip that covers main padding so list cards cannot show through while stuck. */
export function StickyCatalogBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-4 space-y-3 bg-[#fffaf5] px-4 pb-3 pt-4 dark:bg-stone-950 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
      {children}
    </div>
  );
}
