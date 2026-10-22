/**
 * Recover platform login: reset password and invalidate other sessions.
 * Platform users do not use TOTP yet; this bumps tokenVersion and sets a new password.
 *
 *   PLATFORM_ADMIN_EMAIL=ops@example.com PLATFORM_ADMIN_PASSWORD='new-pass' npm run platform:reset-access
 */
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { basePrisma } from "../src/lib/prisma-base";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || "";
  if (!email || !password) {
    console.error("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD.");
    process.exit(1);
  }
  const existing = await basePrisma.platformUser.findUnique({ where: { email } });
  if (!existing) {
    console.error("No platform user with that email.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  await basePrisma.platformUser.update({
    where: { id: existing.id },
    data: { passwordHash: hash, tokenVersion: { increment: 1 }, isActive: true },
  });
  console.log(`Password updated and sessions revoked for ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
