const DEFAULT_PRIMARY = "#ea580c";
const DEFAULT_ACCENT = "#c2410c";

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHexColor(value: string | undefined | null, fallback: string): string {
  const v = (value ?? "").trim();
  if (!v) return fallback;
  const withHash = v.startsWith("#") ? v : `#${v}`;
  if (!HEX.test(withHash)) return fallback;
  if (withHash.length === 4) {
    const r = withHash[1];
    const g = withHash[2];
    const b = withHash[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

/** CSS custom properties for tenant brand (SSR + client). */
export function brandThemeCssVariables(
  primary?: string | null,
  accent?: string | null
): Record<string, string> {
  const p = normalizeHexColor(primary, DEFAULT_PRIMARY);
  const a = normalizeHexColor(accent, DEFAULT_ACCENT);
  return {
    "--brand-600": p,
    "--brand-700": a,
    "--brand-500": p,
    "--brand-400": `color-mix(in srgb, ${p} 78%, white)`,
    "--brand-300": `color-mix(in srgb, ${p} 55%, white)`,
    "--brand-200": `color-mix(in srgb, ${p} 35%, white)`,
    "--brand-100": `color-mix(in srgb, ${p} 18%, white)`,
    "--brand-50": `color-mix(in srgb, ${p} 10%, white)`,
    "--brand-800": `color-mix(in srgb, ${a} 88%, black)`,
    "--brand-900": `color-mix(in srgb, ${a} 75%, black)`,
    "--brand-surface": `color-mix(in srgb, ${p} 8%, white)`,
    "--brand-surface-border": `color-mix(in srgb, ${p} 22%, white)`,
    "--brand-navbar": `color-mix(in srgb, ${p} 6%, white)`,
  };
}

/** Apply storefront + admin brand CSS variables on :root */
export function applyBrandTheme(primary?: string | null, accent?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(brandThemeCssVariables(primary, accent))) {
    root.style.setProperty(key, value);
  }
}
