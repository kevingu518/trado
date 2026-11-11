-- AlterTable
ALTER TABLE "AccountTransaction" ADD COLUMN     "importBatchId" VARCHAR(36),
ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "PositionAdjustment" ADD COLUMN     "fingerprint" VARCHAR(64),
ADD COLUMN     "importBatchId" VARCHAR(36);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "sourceName" VARCHAR(100) NOT NULL,
    "filename" VARCHAR(255),
    "mapping" JSONB NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "sourceName" VARCHAR(100) NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportMapping_userId_idx" ON "ImportMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_userId_sourceName_key" ON "ImportMapping"("userId", "sourceName");

-- CreateIndex
CREATE INDEX "AccountTransaction_importBatchId_idx" ON "AccountTransaction"("importBatchId");

-- CreateIndex
CREATE INDEX "PositionAdjustment_fingerprint_idx" ON "PositionAdjustment"("fingerprint");

-- CreateIndex
CREATE INDEX "PositionAdjustment_importBatchId_idx" ON "PositionAdjustment"("importBatchId");

-- AddForeignKey
ALTER TABLE "PositionAdjustment" ADD CONSTRAINT "PositionAdjustment_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMapping" ADD CONSTRAINT "ImportMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

