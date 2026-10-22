"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { StoreShell } from "@/components/StoreShell";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { Marquee } from "@/components/home/Marquee";
import { useStore } from "@/lib/store";
import { HomeMenu } from "@/components/home/HomeMenu";
import { Reviews } from "@/components/home/Reviews";
import { Faq } from "@/components/home/Faq";
import { HowItWorks } from "@/components/home/HowItWorks";
import { HomeDelivery } from "@/components/home/HomeDelivery";
import { Reveal } from "@/components/home/Reveal";
import { DealCard } from "@/components/DealCard";
import { api } from "@/lib/api";
import { fetchAllDeals } from "@/lib/catalog-api";
import { groupDealsByCategory } from "@/lib/deal-categories";
import { Deal, DeliveryArea } from "@/lib/types";

export default function HomePage() {
  const store = useStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    fetchAllDeals(true)
      .then(setDeals)
      .catch(() => setDeals([]));
    import("@/lib/delivery-areas-public").then((m) => m.fetchPublicDeliveryAreas().then((r) => r.areas))
      .then((areas) => setZones(areas.map((a) => a.name)))
      .catch(() => setZones([]));
  }, []);

  const dealGroups = useMemo(() => groupDealsByCategory(deals), [deals]);
  const singleGroup = dealGroups.length <= 1;

  return (
    <StoreShell>
      <Suspense fallback={null}>
        <HeroCarousel store={store} />
      </Suspense>

      <Marquee />

      {/* Deals */}
      {deals.length > 0 && (
        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <div className="flex items-center gap-2 text-brand-600">
                <Sparkles size={18} />
                <p className="text-xs font-bold uppercase tracking-[0.25em]">Combo deals</p>
              </div>
              <h2 className="font-display mt-2 text-3xl sm:text-4xl">Save on your bag</h2>
              <p className="mt-2 max-w-lg text-stone-600">Combo deals with everything included — add straight to your bag.</p>
            </Reveal>

            <div className="mt-8 space-y-12">
              {dealGroups.map((group, gi) => (
                <div key={group.label}>
                  {!singleGroup && (
                    <Reveal delay={gi * 40}>
                      <h3 className="font-display text-xl font-bold text-stone-900 sm:text-2xl">{group.label}</h3>
                    </Reveal>
                  )}
                  <div className={`grid grid-cols-1 gap-4 sm:gap-5 lg:max-w-3xl ${singleGroup ? "" : "mt-5"}`}>
                    {group.deals.map((deal, i) => (
                      <Reveal key={deal.id} delay={(gi * 3 + i) * 80}>
                        <DealCard deal={deal} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Live menu by category */}
      <Suspense fallback={null}>
        <HomeMenu />
      </Suspense>

      <HowItWorks />

      <Reviews />

      <HomeDelivery zones={zones} />

      <Faq />
    </StoreShell>
  );
}
