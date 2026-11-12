-- AlterTable
ALTER TABLE "StockPrice" ADD COLUMN "turnover" BIGINT;

-- CreateTable
CREATE TABLE "MarketJournal" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "tradeDate" DATE NOT NULL,
    "view" VARCHAR(10) NOT NULL,
    "summary" VARCHAR(100) NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "MarketJournal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketJournal_userId_tradeDate_key" ON "MarketJournal"("userId", "tradeDate");

-- CreateIndex
CREATE INDEX "MarketJournal_userId_tradeDate_idx" ON "MarketJournal"("userId", "tradeDate");

-- AddForeignKey
ALTER TABLE "MarketJournal" ADD CONSTRAINT "MarketJournal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
