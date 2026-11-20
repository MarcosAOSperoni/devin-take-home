-- CreateTable
CREATE TABLE "KycCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "ssn" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assigneeId" TEXT,
    "escalatedById" TEXT,
    "escalationReason" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KycCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KycNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KycNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "KycCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KycNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KycCase_reference_key" ON "KycCase"("reference");

-- CreateIndex
CREATE INDEX "KycCase_status_idx" ON "KycCase"("status");

-- CreateIndex
CREATE INDEX "KycCase_riskLevel_idx" ON "KycCase"("riskLevel");

-- CreateIndex
CREATE INDEX "KycCase_assigneeId_idx" ON "KycCase"("assigneeId");

-- CreateIndex
CREATE INDEX "KycNote_caseId_idx" ON "KycNote"("caseId");
