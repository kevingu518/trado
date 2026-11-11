-- CreateTable
CREATE TABLE "RiskAlertAck" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "tradeId" VARCHAR(36) NOT NULL,
    "alertType" VARCHAR(20) NOT NULL,
    "priceDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAlertAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskAlertAck_userId_tradeId_alertType_priceDate_key" ON "RiskAlertAck"("userId", "tradeId", "alertType", "priceDate");

-- CreateIndex
CREATE INDEX "RiskAlertAck_userId_priceDate_idx" ON "RiskAlertAck"("userId", "priceDate");

-- AddForeignKey
ALTER TABLE "RiskAlertAck" ADD CONSTRAINT "RiskAlertAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAlertAck" ADD CONSTRAINT "RiskAlertAck_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
