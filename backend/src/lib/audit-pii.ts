const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?\d[\d\s\-()]{8,}\d)/g;

export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return "***@***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function maskPiiInText(text: string): string {
  return text
    .replace(EMAIL_RE, (m) => maskEmail(m))
    .replace(PHONE_RE, (m) => maskPhone(m));
}

export function maskPiiValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return maskPiiInText(value);
  if (Array.isArray(value)) return value.map(maskPiiValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/email/i.test(k) && typeof v === "string") out[k] = maskEmail(v);
      else if (/phone/i.test(k) && typeof v === "string") out[k] = maskPhone(v);
      else out[k] = maskPiiValue(v);
    }
    return out;
  }
  return value;
}
