-- 修正 Trade 表的 direction 值
-- 將 'buy' 改為 'long'，'sell' 改為 'short'

UPDATE "Trade" 
SET "direction" = 'long' 
WHERE "direction" = 'buy';

UPDATE "Trade" 
SET "direction" = 'short' 
WHERE "direction" = 'sell';

-- 檢查是否還有其他不正確的值（可選，用於除錯）
-- SELECT DISTINCT "direction" FROM "Trade" WHERE "direction" NOT IN ('long', 'short');
