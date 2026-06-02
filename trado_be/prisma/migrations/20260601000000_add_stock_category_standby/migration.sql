-- AlterTable
ALTER TABLE "StockCategory" ADD COLUMN "isStandby" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "StockCategory_userId_isStandby_idx" ON "StockCategory"("userId", "isStandby");
