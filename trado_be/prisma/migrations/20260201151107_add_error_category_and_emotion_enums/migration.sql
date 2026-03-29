/*
  Warnings:

  - The `emotion` column on the `Trade` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `errorCategory` column on the `Trade` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('ENTRY_TIMING', 'EXIT_TIMING', 'POSITION_SIZE', 'EMOTION_CONTROL', 'STRATEGY_DEVIATION', 'RISK_MANAGEMENT', 'MARKET_ANALYSIS', 'OTHER');

-- CreateEnum
CREATE TYPE "Emotion" AS ENUM ('CALM', 'ANXIOUS', 'EXCITED', 'FEARFUL', 'GREEDY', 'CONFIDENT', 'DOUBTFUL', 'FRUSTRATED', 'IMPATIENT', 'NEUTRAL');

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "emotion",
ADD COLUMN     "emotion" "Emotion",
DROP COLUMN "errorCategory",
ADD COLUMN     "errorCategory" "ErrorCategory";
