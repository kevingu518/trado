-- CreateTable
CREATE TABLE "StockPrice" (
    "symbol" VARCHAR(20) NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(18,2) NOT NULL,
    "high" DECIMAL(18,2) NOT NULL,
    "low" DECIMAL(18,2) NOT NULL,
    "close" DECIMAL(18,2) NOT NULL,
    "volume" BIGINT NOT NULL DEFAULT 0,
    "source" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "StockPrice_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateIndex
CREATE INDEX "StockPrice_symbol_date_idx" ON "StockPrice"("symbol", "date");
