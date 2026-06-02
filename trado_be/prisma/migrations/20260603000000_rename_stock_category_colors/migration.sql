-- 舊 color name → 新 curated palette name
UPDATE "StockCategory" SET color = 'yellow' WHERE color = 'gold';
UPDATE "StockCategory" SET color = 'indigo' WHERE color = 'geekblue';
UPDATE "StockCategory" SET color = 'pink'   WHERE color = 'magenta';
UPDATE "StockCategory" SET color = 'green'  WHERE color = 'lime';
