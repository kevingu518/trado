/*
  Warnings:

  - You are about to alter the column `totalShares` on the `Trade` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Integer`.
  - You are about to alter the column `avgPrice` on the `Trade` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Decimal(18,2)`.
  - You are about to alter the column `profitLoss` on the `Trade` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Integer`.

*/
-- Step 1: Convert existing data before changing column types
-- Convert totalShares from Decimal to Integer (round to nearest integer)
UPDATE "Trade" SET "totalShares" = ROUND("totalShares"::numeric)::integer WHERE "totalShares" IS NOT NULL;

-- Convert avgPrice from Decimal(18,8) to Decimal(18,2) (round to 2 decimal places)
UPDATE "Trade" SET "avgPrice" = ROUND("avgPrice"::numeric, 2) WHERE "avgPrice" IS NOT NULL;

-- Convert profitLoss from Decimal to Integer (round to nearest integer)
UPDATE "Trade" SET "profitLoss" = ROUND("profitLoss"::numeric)::integer WHERE "profitLoss" IS NOT NULL;

-- Step 2: AlterTable - Change column types
ALTER TABLE "Trade" ALTER COLUMN "totalShares" SET DATA TYPE INTEGER USING ("totalShares"::numeric)::integer;
ALTER TABLE "Trade" ALTER COLUMN "avgPrice" SET DATA TYPE DECIMAL(18,2) USING ROUND("avgPrice"::numeric, 2);
ALTER TABLE "Trade" ALTER COLUMN "profitLoss" SET DATA TYPE INTEGER USING (ROUND("profitLoss"::numeric)::integer);
