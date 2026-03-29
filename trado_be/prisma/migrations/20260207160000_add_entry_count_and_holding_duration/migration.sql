-- AlterTable: 在 Trade 表加入 entryCount 和 holdingDuration 欄位
ALTER TABLE "Trade" ADD COLUMN "entryCount" INTEGER;
ALTER TABLE "Trade" ADD COLUMN "holdingDuration" DECIMAL(10,1);

-- 計算並更新現有資料的 entryCount 和 holdingDuration
-- 注意：這是一個簡化的更新，實際計算邏輯在 calculateTradeMetrics 中
-- 這裡只是一個初始值設定，後續會由 calculateTradeMetrics 自動維護

-- 更新 entryCount（建倉次數）
UPDATE "Trade" t
SET "entryCount" = (
    CASE 
        WHEN t."direction" = 'long' THEN (
            SELECT COUNT(*)
            FROM "PositionAdjustment" pa
            WHERE pa."tradeId" = t."id"
            AND pa."action" = 'buy'
            AND pa."deletedAt" IS NULL
        )
        WHEN t."direction" = 'short' THEN (
            SELECT COUNT(*)
            FROM "PositionAdjustment" pa
            WHERE pa."tradeId" = t."id"
            AND pa."action" = 'sell'
            AND pa."deletedAt" IS NULL
        )
        ELSE 0
    END
)
WHERE EXISTS (
    SELECT 1
    FROM "PositionAdjustment" pa
    WHERE pa."tradeId" = t."id"
    AND pa."deletedAt" IS NULL
);

-- 更新 holdingDuration（持有時間，天數）
UPDATE "Trade" t
SET "holdingDuration" = (
    SELECT 
        CASE 
            WHEN t."closedAt" IS NOT NULL THEN
                ROUND(EXTRACT(EPOCH FROM (t."closedAt" - MIN(pa."timestamp"))) / 86400.0, 1)
            ELSE
                ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(pa."timestamp"))) / 86400.0, 1)
        END
    FROM "PositionAdjustment" pa
    WHERE pa."tradeId" = t."id"
    AND pa."deletedAt" IS NULL
    GROUP BY pa."tradeId"
)
WHERE EXISTS (
    SELECT 1
    FROM "PositionAdjustment" pa
    WHERE pa."tradeId" = t."id"
    AND pa."deletedAt" IS NULL
);
