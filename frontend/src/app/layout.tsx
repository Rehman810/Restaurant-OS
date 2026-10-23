import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { brandThemeCssVariables } from "@/lib/brand-theme";
import { resolveMediaUrl } from "@/lib/media-url";
import { fetchPublicStore } from "@/lib/server-public-store";
import { serverApiBase, tenantCacheTag, tenantProxyHeaders } from "@/lib/server-api";

export async function generateMetadata(): Promise<Metadata> {
  const base = serverApiBase();
  const host = headers().get("host");
  const fallback: Metadata = {
    title: "Your Restaurant — Order in minutes",
    description: "Order online for delivery or takeaway.",
    manifest: "/manifest.json",
  };
  try {
    const res = await fetch(`${base}/settings/public`, {
      headers: tenantProxyHeaders(host),
      next: { revalidate: 30, tags: [tenantCacheTag("settings-public", host)] },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const name = String(data?.settings?.storeName || "").trim() || "Your Restaurant";
    const tag = String(data?.settings?.storeTagline || "").trim() || "Order in minutes";
    const title = `${name} — ${tag}`;
    const description = String(data?.settings?.footerText || "").trim() || `Order online from ${name}.`;
    const faviconRaw = String(data?.settings?.faviconUrl || "").trim();
    const favicon = faviconRaw ? resolveMediaUrl(faviconRaw) : "/icon";
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
      manifest: "/manifest.json",
      icons: {
        icon: faviconRaw ? [{ url: favicon }, { url: "/icon" }] : "/icon",
        shortcut: faviconRaw ? favicon : "/icon",
      },
    };
  } catch {
    return fallback;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = headers().get("host");
  const publicStore = await fetchPublicStore(host);
  const brandStyle = brandThemeCssVariables(
    publicStore?.settings?.primaryColor,
    publicStore?.settings?.accentColor
  ) as CSSProperties;

  return (
    <html lang="en" style={brandStyle}>
      <body className="min-h-screen font-sans">
        <Providers initialStore={publicStore}>{children}</Providers>
      </body>
    </html>
  );
}
