-- CreateTable
CREATE TABLE "CustomerAdminProfile" (
    "directoryId" TEXT NOT NULL,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAdminProfile_pkey" PRIMARY KEY ("directoryId")
);
