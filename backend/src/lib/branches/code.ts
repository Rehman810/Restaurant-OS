const BRANCH_CODE_RE = /^[A-Z0-9]{2,6}$/;

/** Normalize user input to uppercase A-Z/0-9 (2–6 chars). */
export function normalizeBranchCodeInput(raw: string): string {
  const code = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return code;
}

export function suggestBranchCodeFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) {
    return normalizeBranchCodeInput(words[0].slice(0, 6));
  }
  const initials = words.map((w) => w[0]).join("");
  return normalizeBranchCodeInput(initials.slice(0, 6));
}

export function validateBranchCode(code: string): string | null {
  if (!code) return "Branch code is required.";
  if (!BRANCH_CODE_RE.test(code)) {
    return "Use 2–6 characters, letters A–Z and numbers only.";
  }
  return null;
}

/** Code segment used in POS order numbers and tax invoices (uppercase, max 8). */
export function branchCodeForNumbering(code: string): string {
  return (code || "BR").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase() || "BR";
}
