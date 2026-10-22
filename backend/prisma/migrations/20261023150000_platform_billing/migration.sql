CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "PlatformInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID');
CREATE TYPE "PlatformPaymentMethod" AS ENUM ('BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'CHEQUE', 'OTHER');

CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "interval" "PlanInterval" NOT NULL DEFAULT 'MONTHLY',
    "pricePkr" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_restaurantId_key" ON "Subscription"("restaurantId");
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

CREATE TABLE "PlatformInvoice" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "PlatformInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "amountPkr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformInvoice_restaurantId_invoiceNumber_key" ON "PlatformInvoice"("restaurantId", "invoiceNumber");
CREATE INDEX "PlatformInvoice_restaurantId_status_idx" ON "PlatformInvoice"("restaurantId", "status");
CREATE INDEX "PlatformInvoice_subscriptionId_idx" ON "PlatformInvoice"("subscriptionId");

CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PlatformPaymentMethod" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformPayment_restaurantId_idx" ON "PlatformPayment"("restaurantId");
CREATE INDEX "PlatformPayment_invoiceId_idx" ON "PlatformPayment"("invoiceId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Plan" ("id", "slug", "name", "description", "interval", "pricePkr", "entitlements", "updatedAt", "sortOrder")
VALUES
  (
    'plan-starter-0001',
    'starter',
    'Starter',
    'Single branch, core ordering.',
    'MONTHLY',
    15000,
    '{"maxBranches":1,"maxStaff":10,"inventory":true,"dineIn":false,"pos":true,"analytics":false}'::jsonb,
    CURRENT_TIMESTAMP,
    0
  ),
  (
    'plan-growth-0001',
    'growth',
    'Growth',
    'Multi-branch with inventory, dine-in, and analytics.',
    'MONTHLY',
    45000,
    '{"maxBranches":10,"maxStaff":100,"inventory":true,"dineIn":true,"pos":true,"analytics":true}'::jsonb,
    CURRENT_TIMESTAMP,
    1
  );

INSERT INTO "Subscription" ("id", "restaurantId", "planId", "status", "trialEndsAt", "currentPeriodStart", "currentPeriodEnd", "updatedAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  'plan-growth-0001',
  'ACTIVE',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP
FROM "Restaurant" r
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."restaurantId" = r."id");
