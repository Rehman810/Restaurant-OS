import { prisma } from "./prisma";

export async function verifyDatabaseConnection(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export function databaseHelpText() {
  if (process.env.NODE_ENV === "production") {
    return (
      "Set DATABASE_URL in your host dashboard (e.g. Render → Web Service → Environment). " +
      "Use the Postgres **Internal** connection string from the linked database. " +
      "If the provider requires SSL, append ?sslmode=require to the URL."
    );
  }
  return (
    "Local dev: copy backend/.env.example, run `docker compose up -d db` from the repo root, then `cd backend && npx prisma migrate deploy`."
  );
}
