"use client";

import { Star } from "lucide-react";
import { useStore } from "@/lib/store";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Reviews() {
  const store = useStore();
  if (store?.settings.showReviewsSection === false) return null;
  const testimonials = store?.testimonials ?? [];
  const highlights = store?.highlights;
  if (!testimonials.length && !highlights?.show) return null;

  const rating = highlights?.rating;
  const orderCount = highlights?.orderCount;

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Reviews</p>
            <h2 className="font-display mt-3 text-3xl text-stone-900 sm:text-5xl">Loved by locals</h2>
          </div>
          {rating != null && (
            <div
              className="flex items-center gap-3 rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--brand-surface-border)", backgroundColor: "var(--brand-surface)" }}
            >
              <div className="flex gap-0.5 text-brand-500">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} size={14} fill="currentColor" />
                ))}
              </div>
              <div className="text-sm">
                <p className="font-bold text-stone-900">{rating.toFixed(1)}</p>
                {orderCount != null && (
                  <p className="text-xs text-stone-500">{orderCount.toLocaleString("en-US")} orders</p>
                )}
              </div>
            </div>
          )}
        </div>

        {testimonials.length > 0 && (
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {testimonials.slice(0, 6).map((r) => (
              <blockquote
                key={r.id}
                className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-gradient-to-b from-[var(--brand-surface)] to-white p-6 shadow-sm"
                style={{ borderColor: "var(--brand-surface-border)" }}
              >
                <div className="flex gap-0.5 text-brand-500">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} size={12} fill="currentColor" />
                  ))}
                </div>
                <p className="mt-4 flex-1 text-[15px] leading-relaxed text-stone-700">{r.text}</p>
                <div className="mt-6 flex items-center gap-3 border-t pt-5" style={{ borderColor: "var(--brand-surface-border)" }}>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {initials(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{r.name}</p>
                    {r.area && <p className="truncate text-xs text-stone-500">{r.area}</p>}
                  </div>
                </div>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
