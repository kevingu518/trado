-- AlterTable: 加入 isSystem 旗標
ALTER TABLE "Strategy" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- 確保有 gen_random_uuid()（pgcrypto），用來產 system Strategy 的 id
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 為每位使用者建立一筆「雜項」系統策略（若尚未存在）
INSERT INTO "Strategy" (id, "userId", name, "isSystem", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  '雜項',
  true,
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Strategy" s WHERE s."userId" = u.id AND s."isSystem" = true
);

-- 把目前 strategyId 為 NULL 的交易，導向該使用者的系統策略
UPDATE "Trade" t
SET "strategyId" = s.id
FROM "Strategy" s
WHERE t."strategyId" IS NULL
  AND s."userId" = t."userId"
  AND s."isSystem" = true;

-- CreateIndex
CREATE INDEX "Strategy_userId_isSystem_idx" ON "Strategy"("userId", "isSystem");
