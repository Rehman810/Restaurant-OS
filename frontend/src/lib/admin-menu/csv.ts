import type { AdminDishRow } from "./types";

/** Prefix cells that could be interpreted as formulas in Excel. */
export function escapeCsvCell(value: string): string {
  const v = value.replace(/\r/g, " ").replace(/\n/g, " ");
  if (/^[=+\-@]/.test(v)) return `'${v}`;
  if (v.includes(",") || v.includes('"')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function dishesToCsv(rows: AdminDishRow[]): string {
  const header = [
    "id",
    "name",
    "description",
    "category",
    "price",
    "sku",
    "visibility",
    "availability",
    "tags",
    "allergens",
  ];
  const lines = rows.map((r) =>
    [
      r.id,
      r.name,
      r.description,
      r.category,
      String(r.price),
      r.sku ?? "",
      r.visibility,
      r.availability.state,
      r.tags.join("|"),
      r.allergens.join("|"),
    ]
      .map((c) => escapeCsvCell(String(c)))
      .join(",")
  );
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}`;
}

export type ImportPreviewRow = {
  line: number;
  name: string;
  errors: string[];
};

export function parseImportCsv(text: string): { rows: Record<string, string>[]; errors: string[] } {
  const errors: string[] = [];
  const stripped = text.replace(/^\uFEFF/, "");
  const lines = stripped.split(/\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], errors: ["File is empty"] };
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  if (!header.includes("name")) errors.push("Missing name column");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { rows, errors };
}

export function dryRunImport(rows: Record<string, string>[]): ImportPreviewRow[] {
  return rows.map((row, idx) => {
    const errs: string[] = [];
    if (!row.name?.trim()) errs.push("Name is required");
    if (row.name && row.name.length > 80) errs.push("Name too long");
    if (row.price && Number(row.price) <= 0) errs.push("Price must be > 0");
    return { line: idx + 2, name: row.name || "(empty)", errors: errs };
  });
}
