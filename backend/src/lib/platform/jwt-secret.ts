import { randomBytes } from "crypto";

let processSecret: string | undefined;

/** Platform sessions use a separate secret from tenant JWT_SECRET. */
export function platformJwtSecret() {
  const fromEnv = process.env.PLATFORM_JWT_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32 && process.env.NODE_ENV === "production") {
      throw new Error("PLATFORM_JWT_SECRET must be at least 32 characters");
    }
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PLATFORM_JWT_SECRET is required in production");
  }
  if (!processSecret) {
    processSecret = randomBytes(32).toString("hex");
    console.warn("[platform] PLATFORM_JWT_SECRET is not set. Using a process-local secret.");
  }
  return processSecret;
}
