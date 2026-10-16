import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export async function generateMetadata(): Promise<Metadata> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
  const fallback: Metadata = {
    title: "Your Restaurant — Order in minutes",
    description: "Order online for delivery or takeaway.",
    manifest: "/manifest.json",
  };
  try {
    const res = await fetch(`${base}/settings/public`, { next: { revalidate: 30 } });
    if (!res.ok) return fallback;
    const data = await res.json();
    const name = String(data?.settings?.storeName || "").trim() || "Your Restaurant";
    const tag = String(data?.settings?.storeTagline || "").trim() || "Order in minutes";
    const title = `${name} — ${tag}`;
    const description = String(data?.settings?.footerText || "").trim() || `Order online from ${name}.`;
    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      twitter: { card: "summary", title, description },
      manifest: "/manifest.json",
    };
  } catch {
    return fallback;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
