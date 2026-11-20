-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "approvalId" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AccessRequest_status_idx" ON "AccessRequest"("status");

-- CreateIndex
CREATE INDEX "AccessRequest_requesterId_idx" ON "AccessRequest"("requesterId");
