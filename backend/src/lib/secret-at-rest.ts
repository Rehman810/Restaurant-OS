import crypto from "crypto";
import { jwtSecret } from "./jwt-secret";

function keyBytes() {
  return crypto.createHash("sha256").update(jwtSecret()).digest();
}

/** Encrypt tenant SMTP passwords at rest (AES-256-GCM). */
export function encryptSecretAtRest(plain: string) {
  const text = plain.trim();
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecretAtRest(stored: string) {
  const raw = stored.trim();
  if (!raw) return "";
  if (!raw.startsWith("v1:")) return raw;
  const parts = raw.split(":");
  if (parts.length !== 4) return "";
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
