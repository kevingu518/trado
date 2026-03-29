/*
  Warnings:

  - You are about to alter the column `shares` on the `PositionAdjustment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Integer`.
  - You are about to alter the column `price` on the `PositionAdjustment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Decimal(18,2)`.
  - You are about to alter the column `fee` on the `PositionAdjustment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,8)` to `Integer`.

*/
-- Step 1: Convert existing PositionAdjustment data before changing column types
-- Convert shares from Decimal to Integer (round to nearest integer)
UPDATE "PositionAdjustment" SET "shares" = ROUND("shares"::numeric)::integer WHERE "shares" IS NOT NULL;

-- Convert price from Decimal(18,8) to Decimal(18,2) (round to 2 decimal places)
UPDATE "PositionAdjustment" SET "price" = ROUND("price"::numeric, 2) WHERE "price" IS NOT NULL;

-- Convert fee from Decimal to Integer (round to nearest integer)
UPDATE "PositionAdjustment" SET "fee" = ROUND("fee"::numeric)::integer WHERE "fee" IS NOT NULL;

-- Step 2: Alter PositionAdjustment table - Change column types
ALTER TABLE "PositionAdjustment" ALTER COLUMN "shares" SET DATA TYPE INTEGER USING (ROUND("shares"::numeric)::integer);
ALTER TABLE "PositionAdjustment" ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2) USING ROUND("price"::numeric, 2);
ALTER TABLE "PositionAdjustment" ALTER COLUMN "fee" SET DEFAULT 0;
ALTER TABLE "PositionAdjustment" ALTER COLUMN "fee" SET DATA TYPE INTEGER USING (ROUND("fee"::numeric)::integer);

-- Step 3: Add new columns to PositionAdjustment table
ALTER TABLE "PositionAdjustment" ADD COLUMN "stopLoss" DECIMAL(18,2);
ALTER TABLE "PositionAdjustment" ADD COLUMN "note" TEXT;
