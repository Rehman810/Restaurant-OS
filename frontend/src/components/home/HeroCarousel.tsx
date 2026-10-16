"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bike, ChevronLeft, ChevronRight, Clock, Star } from "lucide-react";
import { isLocalPublicAsset, resolveMediaUrl } from "@/lib/media-url";
import { storeStatusLabel } from "@/lib/store-hours";
import { PromoBanner, PublicStore } from "@/lib/types";
import { storeTagline } from "@/lib/branding";
import { HERO_FALLBACK_SLIDES } from "@/lib/storefront-copy";
import { HeroSearchInput } from "./HeroSearchInput";

const FALLBACK_SLIDES: PromoBanner[] = HERO_FALLBACK_SLIDES.map((s) => ({
  ...s,
  isActive: true,
}));

function buildSlides(store: PublicStore | null): PromoBanner[] {
  const active = (store?.banners ?? [])
    .filter((b) => b.isActive && b.imageUrl.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (active.length === 0) return FALLBACK_SLIDES;

  return active.map((banner) => ({
    ...banner,
    imageUrl: resolveMediaUrl(banner.imageUrl),
    linkUrl: banner.linkUrl || "/menu",
  }));
}

function HeroSlideImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  if (isLocalPublicAsset(src)) {
    return <Image src={src} alt={alt} fill className="object-cover" sizes="100vw" priority={priority} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolveMediaUrl(src)} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading={priority ? "eager" : "lazy"} />
  );
}

function SlideControls({
  slides,
  idx,
  setIdx,
  count,
  className = "",
}: {
  slides: PromoBanner[];
  idx: number;
  setIdx: Dispatch<SetStateAction<number>>;
  count: number;
  className?: string;
}) {
  if (count <= 1) return null;

  return (
    <>
      <div className={`absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:bottom-6 md:gap-2 ${className}`}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-5 bg-brand-500 md:w-7" : "w-1.5 bg-white/50 md:bg-white/40 md:hover:bg-white/60"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setIdx((i) => (i - 1 + count) % count)}
        className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-sm hover:bg-white/30 sm:flex md:left-6 md:border md:border-white/20 md:bg-black/30 md:p-2 md:hover:bg-black/50"
        aria-label="Previous"
      >
        <ChevronLeft size={18} className="md:h-5 md:w-5" />
      </button>
      <button
        type="button"
        onClick={() => setIdx((i) => (i + 1) % count)}
        className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-sm hover:bg-white/30 sm:flex md:right-6 md:border md:border-white/20 md:bg-black/30 md:p-2 md:hover:bg-black/50"
        aria-label="Next"
      >
        <ChevronRight size={18} className="md:h-5 md:w-5" />
      </button>
    </>
  );
}

export function HeroCarousel({ store }: { store: PublicStore | null }) {
  const slides = useMemo(() => buildSlides(store), [store?.banners]);
  const [idx, setIdx] = useState(0);
  const count = slides.length;
  const hoursStatus = store ? storeStatusLabel(store.settings) : "";
  const slide = slides[idx];
  const deliveryMin = store?.settings.deliveryEstimateMin ?? 45;
  const tagline = storeTagline(store?.settings);
  const heroSubtitle =
    store?.settings.footerText?.trim() ||
    `${tagline}. Browse the menu and order for delivery or takeaway.`;

  useEffect(() => {
    setIdx(0);
  }, [slides.length, slides[0]?.id]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 5500);
    return () => clearInterval(t);
  }, [count]);

  const trustPills = [
    { icon: Clock, label: `${deliveryMin} min delivery` },
    ...(store?.highlights?.show && store.highlights.rating != null
      ? [{ icon: Star, label: `${store.highlights.rating.toFixed(1)} rating` }]
      : []),
    { icon: Bike, label: "Live tracking" },
  ];

  return (
    <section className="w-full">
      {/* Mobile: compact image carousel + info strip */}
      <div className="md:hidden">
        <div className="relative h-44 w-full overflow-hidden bg-stone-900">
          {slides.map((s, i) => {
            const inner = (
              <>
                <HeroSlideImage src={s.imageUrl} alt={s.title || "Promo"} priority={i === 0} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-950/35 via-transparent to-transparent" />
              </>
            );

            return (
              <div
                key={s.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === idx ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={i !== idx}
              >
                {s.linkUrl ? (
                  <Link href={s.linkUrl} className="block h-full w-full">{inner}</Link>
                ) : (
                  inner
                )}
              </div>
            );
          })}

          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-950/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-brand-500" />
              </span>
              {hoursStatus}
            </span>
          </div>

          <SlideControls slides={slides} idx={idx} setIdx={setIdx} count={count} />
        </div>

        <div className="border-b border-brand-100 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <h1 className="font-display text-lg leading-tight text-stone-900">
                {store?.settings.storeName?.trim() || "Your Restaurant"}
              </h1>
              <p className="mt-0.5 text-xs text-stone-600">{tagline}</p>
              {slide?.title && (
                <p className="mt-0.5 text-xs font-semibold text-brand-700">
                  Tonight: {slide.title}
                </p>
              )}
            </div>
            <HeroSearchInput />
          </div>

          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-3.5">
            {trustPills.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-surface)] px-2.5 py-1 text-[11px] font-semibold text-stone-600 ring-1 ring-brand-100"
              >
                <Icon size={12} className="text-brand-600" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: full immersive hero with text overlay */}
      <div className="relative hidden w-full overflow-hidden bg-stone-950 md:block">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={i !== idx}
          >
            <HeroSlideImage src={s.imageUrl} alt={s.title || "Promo"} priority={i === 0} />
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/75 to-stone-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-stone-950/20" />

        <div className="relative mx-auto flex min-h-[min(72vh,640px)] max-w-6xl items-center px-6 py-20 lg:min-h-[min(78vh,720px)] lg:py-24">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
              </span>
              {hoursStatus}
            </div>

            <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">
              {store?.settings.storeName?.trim() || "Your Restaurant"}
            </h1>

            <p className="mt-4 max-w-md text-base leading-relaxed text-stone-300 sm:text-lg">
              {heroSubtitle}
              {store?.settings.acceptCash === false ? "" : " Cash on delivery available."}
            </p>

            {slide?.title && (
              <p className="mt-3 text-sm font-semibold text-brand-300">
                Tonight: {slide.title}
              </p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#menu-start"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-base font-bold text-white shadow-float transition hover:bg-brand-500"
              >
                See the menu <ArrowRight size={18} />
              </Link>
              <Link
                href="/menu"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Order now
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {trustPills.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-stone-200 backdrop-blur-sm"
                >
                  <Icon size={14} className="text-brand-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <SlideControls slides={slides} idx={idx} setIdx={setIdx} count={count} />
      </div>
    </section>
  );
}
