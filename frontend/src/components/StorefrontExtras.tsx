"use client";

import { ClosedBanner } from "./ClosedBanner";
import { ContactFab } from "./WhatsAppFab";
import { InstallAppBanner } from "./InstallAppBanner";
import { StorePwa } from "./StorePwa";

export function StorefrontExtras() {
  return (
    <>
      <StorePwa />
      <InstallAppBanner />
      <ClosedBanner />
      <ContactFab />
    </>
  );
}
