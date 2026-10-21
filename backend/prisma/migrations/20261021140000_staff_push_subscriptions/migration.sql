CREATE TABLE "StaffPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPushSubscription_endpoint_key" ON "StaffPushSubscription"("endpoint");
CREATE INDEX "StaffPushSubscription_userId_idx" ON "StaffPushSubscription"("userId");

ALTER TABLE "StaffPushSubscription" ADD CONSTRAINT "StaffPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
