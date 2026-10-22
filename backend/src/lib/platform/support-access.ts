import crypto from "crypto";
import jwt from "jsonwebtoken";
import { basePrisma } from "../prisma-base";
import { jwtSecret } from "../jwt-secret";
import { withoutTenant } from "../restaurant-context";

const JWT = jwtSecret();
const DEFAULT_TTL_HOURS = Number(process.env.SUPPORT_ACCESS_TTL_HOURS || 2);

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type SupportAccessClaims = {
  typ: "support";
  sid: string;
  rid: string;
  pid: string;
  email: string;
  name: string;
};

export async function createTenantSupportSession(input: {
  subjectRestaurantId: string;
  platformUserId: string;
  platformEmail: string;
  ttlHours?: number;
}) {
  const ttl = Math.min(24, Math.max(1, input.ttlHours ?? DEFAULT_TTL_HOURS));
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);
  const session = await withoutTenant("create support session", () =>
    basePrisma.tenantSupportSession.create({
      data: {
        subjectRestaurantId: input.subjectRestaurantId,
        platformUserId: input.platformUserId,
        tokenHash: hashToken(token),
        expiresAt,
      },
    })
  );
  return { sessionId: session.id, token, expiresAt };
}

export async function exchangeSupportAccessToken(token: string) {
  const hash = hashToken(token.trim());
  const session = await withoutTenant("exchange support token", () =>
    basePrisma.tenantSupportSession.findUnique({
      where: { tokenHash: hash },
      include: { platformUser: { select: { email: true, name: true, isActive: true } } },
    })
  );
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.platformUser.isActive) {
    throw Object.assign(new Error("This support link is invalid or has expired."), { status: 401 });
  }
  const claims: SupportAccessClaims = {
    typ: "support",
    sid: session.id,
    rid: session.subjectRestaurantId,
    pid: session.platformUserId,
    email: session.platformUser.email,
    name: session.platformUser.name,
  };
  const accessToken = jwt.sign(claims, JWT, { expiresIn: Math.max(60, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)) });
  return { accessToken, expiresAt: session.expiresAt, restaurantId: session.subjectRestaurantId };
}

export async function verifySupportAccessToken(token: string) {
  const payload = jwt.verify(token, JWT) as SupportAccessClaims;
  if (payload.typ !== "support") return null;
  const session = await withoutTenant("verify support session", () =>
    basePrisma.tenantSupportSession.findUnique({
      where: { id: payload.sid },
      select: { revokedAt: true, expiresAt: true, subjectRestaurantId: true },
    })
  );
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.subjectRestaurantId !== payload.rid) return null;
  return payload;
}

export async function revokeTenantSupportSession(sessionId: string) {
  await withoutTenant("revoke support session", () =>
    basePrisma.tenantSupportSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  );
}
