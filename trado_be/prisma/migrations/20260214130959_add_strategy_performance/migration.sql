-- CreateTable: 建立 StrategyPerformance 表
CREATE TABLE "StrategyPerformance" (
    "id" VARCHAR(36) NOT NULL,
    "strategyId" VARCHAR(36) NOT NULL,
    "totalProfitLoss" INTEGER,
    "winRate" DECIMAL(5,2),
    "riskRewardRatio" DECIMAL(5,2),
    "avgHoldingDuration" DECIMAL(10,1),
    "maxDrawdown" DECIMAL(5,2),
    "totalTrades" INTEGER DEFAULT 0,
    "winningTrades" INTEGER DEFAULT 0,
    "losingTrades" INTEGER DEFAULT 0,
    "isCurrentSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "snapshotDate" TIMESTAMP(6) NOT NULL,
    "periodStart" TIMESTAMP(6),
    "periodEnd" TIMESTAMP(6),
    "sourceType" VARCHAR(20) NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "StrategyPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: 建立索引
CREATE INDEX "StrategyPerformance_strategyId_isCurrentSnapshot_idx" 
    ON "StrategyPerformance"("strategyId", "isCurrentSnapshot");
CREATE INDEX "StrategyPerformance_strategyId_snapshotDate_idx" 
    ON "StrategyPerformance"("strategyId", "snapshotDate");
CREATE INDEX "StrategyPerformance_strategyId_periodStart_idx" 
    ON "StrategyPerformance"("strategyId", "periodStart");

-- AddForeignKey: 建立外鍵
ALTER TABLE "StrategyPerformance" ADD CONSTRAINT "StrategyPerformance_strategyId_fkey" 
    FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
