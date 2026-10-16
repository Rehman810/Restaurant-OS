ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalPinHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalPinFailedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalPinLockedUntil" TIMESTAMP(3);

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "maxCashierDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "requireApprovalForVoid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "requireApprovalForRefund" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "requireApprovalForPriceOverride" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "voidReasonOptions" JSONB NOT NULL DEFAULT '["Wrong order","Customer changed mind","Kitchen error","Other"]';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "discountReasonOptions" JSONB NOT NULL DEFAULT '["Staff courtesy","Service issue","Manager special","Other"]';
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "refundReasonOptions" JSONB NOT NULL DEFAULT '["Order cancelled","Wrong charge","Quality issue","Other"]';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adjustmentReasonCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adjustmentReasonNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adjustmentRequestedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "adjustmentApprovedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "voidReasonCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "voidReasonNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "voidApprovedById" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundReasonCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundReasonNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundApprovedById" TEXT;
