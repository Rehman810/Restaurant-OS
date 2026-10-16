CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "loyaltyEarnPer100" DECIMAL(10,2) NOT NULL DEFAULT 1;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "loyaltyRedeemPerPoint" DECIMAL(10,2) NOT NULL DEFAULT 1;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "loyaltyMaxRedeemPercent" DECIMAL(5,2) NOT NULL DEFAULT 20;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "type" "CouponDiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxDiscount" DECIMAL(10,2),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Coupon_restaurantId_code_key" ON "Coupon"("restaurantId", "code");
CREATE INDEX "Coupon_restaurantId_isActive_idx" ON "Coupon"("restaurantId", "isActive");

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
