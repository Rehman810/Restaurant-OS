-- Phase 3: plan versions, feature flags, support tickets, alerts, tenant activity

CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pricePkr" INTEGER NOT NULL,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");

ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "pinnedPlanVersionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "entitlementOverrides" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_pinnedPlanVersionId_fkey" FOREIGN KEY ("pinnedPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlatformFeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformFeatureFlag_key_key" ON "PlatformFeatureFlag"("key");

CREATE TABLE "PlatformTenantFeatureFlag" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformTenantFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformTenantFeatureFlag_flagId_restaurantId_key" ON "PlatformTenantFeatureFlag"("flagId", "restaurantId");
CREATE INDEX "PlatformTenantFeatureFlag_restaurantId_idx" ON "PlatformTenantFeatureFlag"("restaurantId");

ALTER TABLE "PlatformTenantFeatureFlag" ADD CONSTRAINT "PlatformTenantFeatureFlag_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "PlatformFeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformTenantFeatureFlag" ADD CONSTRAINT "PlatformTenantFeatureFlag_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "createdByEmail" TEXT NOT NULL DEFAULT '',
    "assignedToEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_restaurantId_status_idx" ON "SupportTicket"("restaurantId", "status");
CREATE INDEX "SupportTicket_updatedAt_idx" ON "SupportTicket"("updatedAt");

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL DEFAULT '',
    "isOperator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "PlatformAlertChannel" AS ENUM ('EMAIL', 'SLACK');

CREATE TABLE "PlatformAlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actionPattern" TEXT NOT NULL DEFAULT '',
    "channel" "PlatformAlertChannel" NOT NULL DEFAULT 'EMAIL',
    "target" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAlertRule_pkey" PRIMARY KEY ("id")
);
