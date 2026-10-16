"use client";

import { useStore } from "@/lib/store";
import { storeDisplayName } from "@/lib/branding";
import { paymentSummary } from "@/lib/settings-validate";

export function FaqPageContent() {
  const store = useStore();
  const name = storeDisplayName(store?.settings);
  const phone = store?.settings?.phone?.trim();
  const city = store?.settings?.city?.trim();
  const cash = store?.settings?.acceptCash !== false;
  const card = store?.settings?.acceptCard !== false;

  const faqs = [
    {
      q: "Do I need an account to order?",
      a: `No. Guest checkout is available at ${name} — enter your name, phone, and delivery details.`,
    },
    {
      q: "What payment methods do you accept?",
      a: paymentSummary(cash, card),
    },
    {
      q: "How do I track my order?",
      a: "After placing an order you will see a live status page. You can also use Track order from the menu.",
    },
    {
      q: "What is the minimum order?",
      a: "Minimum order amount is shown in your cart and at checkout. It may change during promotions.",
    },
    {
      q: "Can I pick up instead of delivery?",
      a: city
        ? `Yes. Choose Takeaway when prompted and collect from our ${city} location.`
        : "Yes. Choose Takeaway when prompted and collect from the restaurant.",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl">FAQ</h1>
      <p className="mt-2 text-sm text-stone-600">
        Questions about {name}
        {phone ? (
          <>
            {" "}
            ·{" "}
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700 hover:underline">
              {phone}
            </a>
          </>
        ) : null}
      </p>
      <dl className="mt-8 space-y-6">
        {faqs.map((f) => (
          <div key={f.q} className="rounded-2xl border border-brand-100 bg-white p-5">
            <dt className="font-semibold text-stone-900">{f.q}</dt>
            <dd className="mt-2 text-sm text-stone-600">{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
