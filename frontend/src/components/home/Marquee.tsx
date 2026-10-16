import { MARQUEE_DEFAULT } from "@/lib/storefront-copy";

export function Marquee() {
  const row = [...MARQUEE_DEFAULT, ...MARQUEE_DEFAULT];
  return (
    <div className="overflow-hidden border-y border-brand-200/60 bg-brand-900 py-3">
      <div className="marquee-track flex w-max gap-10 px-4 text-sm font-semibold uppercase tracking-[0.2em] text-brand-100">
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="flex shrink-0 items-center gap-10">
            {item}
            <span className="text-brand-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
