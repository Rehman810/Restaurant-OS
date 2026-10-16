import type { MetadataRoute } from "next";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
  let name = "Restaurant";
  let theme = "#ea580c";
  try {
    const res = await fetch(`${base}/settings/public`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      name = String(data?.settings?.storeName || "").trim() || name;
      theme = String(data?.settings?.primaryColor || "").trim() || theme;
    }
  } catch {
    /* fallback */
  }
  return {
    name,
    short_name: name.slice(0, 12),
    description: "Order food online — delivery and takeaway",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: theme,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
