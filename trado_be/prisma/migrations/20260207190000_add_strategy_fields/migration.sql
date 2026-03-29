-- CreateEnum: 建立 StrategyCategory enum
CREATE TYPE "StrategyCategory" AS ENUM ('TREND_FOLLOWING', 'CONTRARIAN', 'DAY_TRADING', 'DIVIDEND_INVESTING');

-- AlterTable: 在 Strategy 表加入所有新欄位

-- [選股與條件]
ALTER TABLE "Strategy" ADD COLUMN "stockSelectionCriteria" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "entryConditions" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "exitConditions" TEXT;

-- [風險管理]
ALTER TABLE "Strategy" ADD COLUMN "riskManagement" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "maxDrawdownTolerance" DECIMAL(5,2);

-- [績效預期]
ALTER TABLE "Strategy" ADD COLUMN "expectedWinRate" DECIMAL(5,2);
ALTER TABLE "Strategy" ADD COLUMN "expectedProfitLossRatio" DECIMAL(5,2);

-- [交易規則]
ALTER TABLE "Strategy" ADD COLUMN "watchlistTrigger" TEXT;
ALTER TABLE "Strategy" ADD COLUMN "addPositionRules" TEXT;

-- AlterTable: 將 category 欄位改為 enum 類型
-- 先將現有的 category 值轉換（如果有的話）
-- 注意：如果現有資料中有不符合 enum 的值，需要先清理
ALTER TABLE "Strategy" ALTER COLUMN "category" TYPE "StrategyCategory" USING "category"::"StrategyCategory";

-- CreateIndex: 為 category 建立索引（方便按類型查詢）
CREATE INDEX "Strategy_category_idx" ON "Strategy"("category");
