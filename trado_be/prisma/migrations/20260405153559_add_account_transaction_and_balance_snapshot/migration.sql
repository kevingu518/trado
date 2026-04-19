-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "method" VARCHAR(50),
    "notes" TEXT,
    "date" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "date" DATE NOT NULL,
    "cashBalance" INTEGER NOT NULL,
    "positionValue" INTEGER NOT NULL DEFAULT 0,
    "totalAssets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountTransaction_userId_date_idx" ON "AccountTransaction"("userId", "date");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_userId_date_idx" ON "BalanceSnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSnapshot_userId_date_key" ON "BalanceSnapshot"("userId", "date");

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
