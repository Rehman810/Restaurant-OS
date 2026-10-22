/**
 * Create or update a platform operator (never run in production seed).
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=ops@example.com PLATFORM_ADMIN_PASSWORD='...' npm run platform:create-admin
 */
import path from "path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PlatformRole } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || "";
  const name = (process.env.PLATFORM_ADMIN_NAME || "Platform Admin").trim();
  const role = (process.env.PLATFORM_ADMIN_ROLE || "SUPER_ADMIN") as PlatformRole;

  if (!email || !password) {
    console.error("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  if (!Object.values(PlatformRole).includes(role)) {
    console.error(`Invalid PLATFORM_ADMIN_ROLE: ${role}`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await basePrisma.platformUser.upsert({
    where: { email },
    create: { email, name, passwordHash: hash, role, isActive: true },
    update: { name, passwordHash: hash, role, isActive: true, tokenVersion: { increment: 1 } },
  });
  console.log(`Platform user ready: ${user.email} (${user.role}) id=${user.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
