-- CreateTable
CREATE TABLE "CorporateAction" (
    "symbol" VARCHAR(20) NOT NULL,
    "exDate" DATE NOT NULL,
    "preClose" DECIMAL(18,4) NOT NULL,
    "refPrice" DECIMAL(18,4) NOT NULL,
    "factor" DECIMAL(12,8) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "cashDividend" DECIMAL(18,6),
    "stockRatio" DECIMAL(18,8),
    "source" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "CorporateAction_pkey" PRIMARY KEY ("symbol","exDate")
);

-- CreateIndex
CREATE INDEX "CorporateAction_exDate_idx" ON "CorporateAction"("exDate");
