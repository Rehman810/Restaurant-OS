"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Flame, MapPin, Phone } from "lucide-react";
import { PoweredBy } from "@/components/PoweredBy";
import { StoreLogo } from "@/components/StoreLogo";
import { storeDisplayName, storeTagline } from "@/lib/branding";
import { useStore } from "@/lib/store";

export function StoreFooter() {
  const store = useStore();
  const settings = store?.settings;
  const phone = settings?.phone || "";
  const address = settings?.address ?? "Restaurant address";
  const name = storeDisplayName(settings);

  return (
    <footer className="relative bg-stone-950 text-stone-400">
      <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <div className="relative -translate-y-10 overflow-hidden rounded-[2rem] shadow-float sm:-translate-y-14">
          <div className="absolute inset-0">
            <Image
              src="/carousel/carousel-broast.png"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1152px"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/92 via-stone-950/78 to-stone-950/55" />
          </div>
          <div className="relative flex flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center sm:px-10 sm:py-12">
            <div className="max-w-md text-white">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-300">
                <Flame size={14} /> Still hungry?
              </p>
              <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">
                Craving something <span className="text-brand-400">right now?</span>
              </h2>
              <p className="mt-3 text-sm text-stone-300">
                {settings?.footerText?.trim() || `Order online${settings?.city ? ` in ${settings.city}` : ""}`}
              </p>
            </div>
            <Link
              href="/menu"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand-600 px-7 text-sm font-bold text-white shadow-lg transition hover:bg-brand-500"
            >
              Order now <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-4 sm:px-6 sm:pb-32 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="flex items-center gap-2.5 font-display text-2xl text-white">
            <StoreLogo
              logoUrl={settings?.logoUrl}
              size="lg"
              rounded="2xl"
              fallbackClassName="bg-brand-600 text-white shadow-md shadow-brand-900/40"
            />
            {name}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-400">
            {storeTagline(settings)} — fresh food from our kitchen, delivered to your door.
          </p>
          {[
            { href: settings?.facebookUrl, label: "Facebook" },
            { href: settings?.instagramUrl, label: "Instagram" },
            { href: settings?.tiktokUrl, label: "TikTok" },
            { href: settings?.youtubeUrl, label: "YouTube" },
          ].some((l) => l.href?.trim()) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { href: settings?.facebookUrl, label: "Facebook" },
                { href: settings?.instagramUrl, label: "Instagram" },
                { href: settings?.tiktokUrl, label: "TikTok" },
                { href: settings?.youtubeUrl, label: "YouTube" },
              ]
                .filter((l) => l.href?.trim())
                .map((link) => (
                  <a
                    key={link.label}
                    href={link.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-stone-300 transition hover:border-white/25 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Explore</p>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              { href: "/menu", label: "Full menu" },
              { href: "/orders", label: "Track order" },
              { href: "/faq", label: "FAQ" },
              { href: "/privacy", label: "Privacy" },
              { href: "/login", label: "Customer login" },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-400">Visit & call</p>
          <ul className="mt-5 space-y-4 text-sm">
            {phone ? (
            <li className="flex gap-3">
              <Phone size={16} className="mt-0.5 shrink-0 text-brand-500" />
              <a href={`tel:${phone}`} className="font-semibold text-stone-200 hover:text-white">{phone}</a>
            </li>
            ) : null}
            <li className="flex gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-brand-500" />
              <span>{address}</span>
            </li>
            <li className="flex gap-3">
              <Clock size={16} className="mt-0.5 shrink-0 text-brand-500" />
              <span>{store?.hoursLabel ?? "See opening hours"} daily</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
          <p className="text-center text-xs text-stone-500 sm:text-left">
            © {new Date().getFullYear()} {name}
          </p>
          <PoweredBy variant="badge" />
        </div>
      </div>
    </footer>
  );
}
