-- Update existing Trade data to match new format
-- Convert totalShares from Decimal to Integer (round to nearest integer)
UPDATE "Trade" SET "totalShares" = ROUND("totalShares"::numeric)::integer WHERE "totalShares" IS NOT NULL;

-- Convert avgPrice from Decimal(18,8) to Decimal(18,2) (round to 2 decimal places)
UPDATE "Trade" SET "avgPrice" = ROUND("avgPrice"::numeric, 2) WHERE "avgPrice" IS NOT NULL;

-- Convert profitLoss from Decimal to Integer (round to nearest integer)
UPDATE "Trade" SET "profitLoss" = ROUND("profitLoss"::numeric)::integer WHERE "profitLoss" IS NOT NULL;

-- Update symbols to Taiwanese stock codes if they are not already
-- This will randomly assign Taiwanese stock codes to existing trades
UPDATE "Trade" 
SET "symbol" = (
  SELECT symbol FROM (
    VALUES 
      ('2330'), ('2317'), ('2454'), ('2308'), ('2412'), 
      ('1301'), ('1303'), ('2891'), ('2882'), ('2886'), 
      ('2892'), ('2002'), ('2207'), ('2382'), ('2303')
  ) AS stocks(symbol)
  ORDER BY RANDOM()
  LIMIT 1
)
WHERE "symbol" NOT IN ('2330', '2317', '2454', '2308', '2412', '1301', '1303', '2891', '2882', '2886', '2892', '2002', '2207', '2382', '2303');
