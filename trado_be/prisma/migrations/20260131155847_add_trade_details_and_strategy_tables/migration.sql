-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "emotion" VARCHAR(20),
ADD COLUMN     "errorCategory" VARCHAR(50),
ADD COLUMN     "grossProfitLoss" INTEGER,
ADD COLUMN     "netProfitLoss" INTEGER,
ADD COLUMN     "positionNote" TEXT,
ADD COLUMN     "profitLossRatio" DECIMAL(5,4),
ADD COLUMN     "selfRating" INTEGER,
ADD COLUMN     "totalFee" INTEGER,
ADD COLUMN     "totalTax" INTEGER,
ADD COLUMN     "totalValue" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeStrategy" (
    "id" VARCHAR(36) NOT NULL,
    "tradeId" VARCHAR(36) NOT NULL,
    "strategyId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Strategy_userId_idx" ON "Strategy"("userId");

-- CreateIndex
CREATE INDEX "TradeStrategy_tradeId_idx" ON "TradeStrategy"("tradeId");

-- CreateIndex
CREATE INDEX "TradeStrategy_strategyId_idx" ON "TradeStrategy"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeStrategy_tradeId_strategyId_key" ON "TradeStrategy"("tradeId", "strategyId");

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeStrategy" ADD CONSTRAINT "TradeStrategy_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeStrategy" ADD CONSTRAINT "TradeStrategy_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
