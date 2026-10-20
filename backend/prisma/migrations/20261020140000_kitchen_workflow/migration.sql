-- AlterTable
ALTER TABLE "Order" ADD COLUMN "promisedAt" TIMESTAMP(3),
ADD COLUMN "isRush" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "kotPrintedAt" TIMESTAMP(3),
ADD COLUMN "kotPrintCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "kitchenDoneAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "KotPrintLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "isReprint" BOOLEAN NOT NULL DEFAULT false,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KotPrintLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KotPrintLog_orderId_createdAt_idx" ON "KotPrintLog"("orderId", "createdAt");

ALTER TABLE "KotPrintLog" ADD CONSTRAINT "KotPrintLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
