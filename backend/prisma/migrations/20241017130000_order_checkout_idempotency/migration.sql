ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "checkoutIdempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_checkoutIdempotencyKey_key" ON "Order"("checkoutIdempotencyKey");
