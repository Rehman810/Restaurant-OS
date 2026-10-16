"use client";

import { useStore } from "@/lib/store";
import { storeDisplayName } from "@/lib/branding";

export function PrivacyPageContent() {
  const store = useStore();
  const name = storeDisplayName(store?.settings);
  const phone = store?.settings?.phone?.trim();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-stone-500">{name}</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-stone-600">
        <p>
          We collect your name, phone number, and delivery address only to process and fulfill your order with {name}.
          Guest orders are tracked with a secure token stored in your browser session.
        </p>
        <p>
          We do not sell your personal information. Order data is retained for kitchen operations and customer support.
          Staff accounts are protected with encrypted passwords.
        </p>
        <p>
          For questions about your data, contact us
          {phone ? (
            <>
              {" "}
              at{" "}
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-brand-700 hover:underline">
                {phone}
              </a>
            </>
          ) : (
            " using the phone number listed on our website"
          )}
          .
        </p>
      </div>
    </div>
  );
}
