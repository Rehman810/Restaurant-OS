const FORMULA_PREFIX = /^[=+\-@]/;

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  const guarded = FORMULA_PREFIX.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function buildCsv(rows: string[][]): string {
  const body = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
  return `\uFEFF${body}`;
}
