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

/** Apply storefront + admin brand CSS variables on :root */
export function applyBrandTheme(primary?: string | null, accent?: string | null) {
  const root = document.documentElement;
  const p = normalizeHexColor(primary, DEFAULT_PRIMARY);
  const a = normalizeHexColor(accent, DEFAULT_ACCENT);

  root.style.setProperty("--brand-600", p);
  root.style.setProperty("--brand-700", a);
  root.style.setProperty("--brand-500", p);
  root.style.setProperty("--brand-400", `color-mix(in srgb, ${p} 78%, white)`);
  root.style.setProperty("--brand-300", `color-mix(in srgb, ${p} 55%, white)`);
  root.style.setProperty("--brand-200", `color-mix(in srgb, ${p} 35%, white)`);
  root.style.setProperty("--brand-100", `color-mix(in srgb, ${p} 18%, white)`);
  root.style.setProperty("--brand-50", `color-mix(in srgb, ${p} 10%, white)`);
  root.style.setProperty("--brand-800", `color-mix(in srgb, ${a} 88%, black)`);
  root.style.setProperty("--brand-900", `color-mix(in srgb, ${a} 75%, black)`);
  root.style.setProperty("--brand-surface", `color-mix(in srgb, ${p} 8%, white)`);
  root.style.setProperty("--brand-surface-border", `color-mix(in srgb, ${p} 22%, white)`);
  root.style.setProperty("--brand-navbar", `color-mix(in srgb, ${p} 6%, white)`);
}
