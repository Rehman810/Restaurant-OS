-- AlterTable
ALTER TABLE "Order" ADD COLUMN "readyAt" TIMESTAMP(3);

-- Backfill ready timestamp from status history where available
UPDATE "Order" o
SET "readyAt" = sub.ts
FROM (
  SELECT DISTINCT ON ("orderId") "orderId", "createdAt" AS ts
  FROM "OrderEvent"
  WHERE "toStatus" = 'READY'
  ORDER BY "orderId", "createdAt" DESC
) sub
WHERE o.id = sub."orderId" AND o."readyAt" IS NULL;
