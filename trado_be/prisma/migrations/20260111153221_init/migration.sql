-- CreateTable
CREATE TABLE "Trade" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "assetType" VARCHAR(20) NOT NULL DEFAULT 'stock',
    "direction" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "totalShares" DECIMAL(18,8) NOT NULL,
    "avgPrice" DECIMAL(18,8) NOT NULL,
    "profitLoss" DECIMAL(18,8),
    "followedDiscipline" BOOLEAN,
    "reviewNotes" TEXT,
    "exitReason" VARCHAR(50),
    "createdAt" TIMESTAMP(6) NOT NULL,
    "closedAt" TIMESTAMP(6),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionAdjustment" (
    "id" VARCHAR(36) NOT NULL,
    "tradeId" VARCHAR(36) NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "shares" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trade_userId_symbol_status_idx" ON "Trade"("userId", "symbol", "status");

-- CreateIndex
CREATE INDEX "PositionAdjustment_tradeId_timestamp_idx" ON "PositionAdjustment"("tradeId", "timestamp");

-- AddForeignKey
ALTER TABLE "PositionAdjustment" ADD CONSTRAINT "PositionAdjustment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
