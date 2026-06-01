-- CreateTable: StockCategory
CREATE TABLE "StockCategory" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "targetRatio" DECIMAL(5,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "StockCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StockCategoryMap
CREATE TABLE "StockCategoryMap" (
    "userId" VARCHAR(36) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "categoryId" VARCHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "StockCategoryMap_pkey" PRIMARY KEY ("userId", "symbol")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCategory_userId_name_key" ON "StockCategory"("userId", "name");
CREATE INDEX "StockCategory_userId_idx" ON "StockCategory"("userId");
CREATE INDEX "StockCategoryMap_categoryId_idx" ON "StockCategoryMap"("categoryId");

-- AddForeignKey
ALTER TABLE "StockCategory" ADD CONSTRAINT "StockCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCategoryMap" ADD CONSTRAINT "StockCategoryMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCategoryMap" ADD CONSTRAINT "StockCategoryMap_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StockCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
