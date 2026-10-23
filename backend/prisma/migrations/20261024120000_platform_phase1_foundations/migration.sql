-- Phase 1: test tenants, platform user 2FA, tenant payment proof queue

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE TYPE "PlatformPaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "PlatformPaymentProof" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PlatformPaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "amountPkr" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "receiptPath" TEXT NOT NULL DEFAULT '',
    "status" "PlatformPaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "submittedBy" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformPaymentProof_status_createdAt_idx" ON "PlatformPaymentProof"("status", "createdAt");
CREATE INDEX "PlatformPaymentProof_restaurantId_idx" ON "PlatformPaymentProof"("restaurantId");
CREATE INDEX "PlatformPaymentProof_invoiceId_idx" ON "PlatformPaymentProof"("invoiceId");

ALTER TABLE "PlatformPaymentProof" ADD CONSTRAINT "PlatformPaymentProof_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformPaymentProof" ADD CONSTRAINT "PlatformPaymentProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
