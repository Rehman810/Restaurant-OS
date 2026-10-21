import { normalizeHexColor } from "./brand-theme";

function hexToRgb(hex: string) {
  const n = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function channelLuminance(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(hexA: string, hexB: string) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mixHex(hex: string, target: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(a.r * (1 - t) + b.r * t);
  const g = Math.round(a.g * (1 - t) + b.g * t);
  const bl = Math.round(a.b * (1 - t) + b.b * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function darkenUntilContrast(
  foreground: string,
  background: string,
  minRatio: number,
  adjustBackground = true,
  maxSteps = 16
) {
  let fg = normalizeHexColor(foreground, "#ffffff");
  let bg = normalizeHexColor(background, "#000000");
  let ratio = contrastRatio(fg, bg);
  for (let step = 0; step < maxSteps && ratio < minRatio; step += 1) {
    if (adjustBackground) bg = mixHex(bg, "#000000", 0.07);
    else fg = mixHex(fg, "#000000", 0.07);
    ratio = contrastRatio(fg, bg);
  }
  return { foreground: fg, background: bg, ratio };
}

export type ContrastCheck = {
  id: string;
  label: string;
  foreground: string;
  background: string;
  minRatio: number;
  ratio: number;
  pass: boolean;
};

export function brandContrastReport(primary: string, accent: string): ContrastCheck[] {
  const p = normalizeHexColor(primary, "#ea580c");
  const a = normalizeHexColor(accent, "#c2410c");
  const white = "#ffffff";
  const page = "#ffffff";

  const checks: Omit<ContrastCheck, "ratio" | "pass">[] = [
    {
      id: "button",
      label: "White label on primary button",
      foreground: white,
      background: p,
      minRatio: 3,
    },
    {
      id: "primary-text",
      label: "Primary color as text on white",
      foreground: p,
      background: page,
      minRatio: 4.5,
    },
    {
      id: "accent-text",
      label: "Accent color as text on white",
      foreground: a,
      background: page,
      minRatio: 4.5,
    },
  ];

  return checks.map((c) => {
    const ratio = contrastRatio(c.foreground, c.background);
    return { ...c, ratio, pass: ratio >= c.minRatio };
  });
}

export const BRAND_COLOR_PRESETS = [
  { name: "Restaurant orange", primary: "#ea580c", accent: "#c2410c" },
  { name: "Tomato red", primary: "#dc2626", accent: "#b91c1c" },
  { name: "Forest", primary: "#15803d", accent: "#166534" },
  { name: "Ocean", primary: "#0369a1", accent: "#075985" },
  { name: "Plum", primary: "#7c3aed", accent: "#6d28d9" },
] as const;
