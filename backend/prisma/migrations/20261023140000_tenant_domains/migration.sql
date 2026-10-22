CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");
CREATE INDEX "TenantDomain_restaurantId_idx" ON "TenantDomain"("restaurantId");

ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TenantDomain" ("id", "restaurantId", "hostname", "isPrimary", "verifiedAt", "createdAt")
SELECT gen_random_uuid()::text, "id", lower("hostname"), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Restaurant"
WHERE "hostname" IS NOT NULL AND trim("hostname") <> '';
