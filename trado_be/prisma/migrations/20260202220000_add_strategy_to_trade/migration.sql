-- AlterTable: 在 Trade 表加入 strategyId 欄位
ALTER TABLE "Trade" ADD COLUMN "strategyId" VARCHAR(36);

-- 資料遷移：將現有的 TradeStrategy 資料遷移到 Trade.strategyId
-- 如果一個 Trade 有多個 Strategy，只取第一個（按 createdAt 排序）
UPDATE "Trade" t
SET "strategyId" = (
    SELECT ts."strategyId"
    FROM "TradeStrategy" ts
    WHERE ts."tradeId" = t."id"
    ORDER BY ts."createdAt" ASC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM "TradeStrategy" ts
    WHERE ts."tradeId" = t."id"
);

-- AddForeignKey: 建立 Trade.strategyId 到 Strategy.id 的外鍵關聯
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: 為 strategyId 建立索引（可選，但建議建立以提升查詢效能）
CREATE INDEX "Trade_strategyId_idx" ON "Trade"("strategyId");
