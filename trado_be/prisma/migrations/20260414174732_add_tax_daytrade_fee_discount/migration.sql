-- AlterTable
ALTER TABLE "PositionAdjustment" ADD COLUMN     "isDayTrade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tax" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brokerFeeDiscount" DECIMAL(3,2);
