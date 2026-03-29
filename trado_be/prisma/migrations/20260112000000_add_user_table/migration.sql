-- Step 1: Create User table
CREATE TABLE "User" (
    "id" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "picture" TEXT,
    "googleId" VARCHAR(255) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create indexes for User table
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Step 3: Add updatedAt column to Trade table with default value
-- First add the column as nullable
ALTER TABLE "Trade" ADD COLUMN "updatedAt" TIMESTAMP(6);

-- Step 4: Update existing Trade rows to set updatedAt to createdAt or current timestamp
UPDATE "Trade" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);

-- Step 5: Make updatedAt NOT NULL now that all rows have values
ALTER TABLE "Trade" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Trade" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Step 6: Create a temporary default user for existing trades (if needed)
-- This creates a user with a placeholder email/googleId for existing trades
-- You should update this user or create proper users after migration
DO $$
DECLARE
    trade_user_id VARCHAR(36);
    user_created_at TIMESTAMP(6);
BEGIN
    FOR trade_user_id IN SELECT DISTINCT "userId" FROM "Trade" WHERE "userId" NOT IN (SELECT "id" FROM "User")
    LOOP
        SELECT MIN("createdAt") INTO user_created_at FROM "Trade" WHERE "userId" = trade_user_id;
        
        INSERT INTO "User" ("id", "email", "googleId", "createdAt", "updatedAt")
        VALUES (
            trade_user_id,
            'temp_' || trade_user_id || '@placeholder.com',
            'temp_' || trade_user_id,
            COALESCE(user_created_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ("id") DO NOTHING;
    END LOOP;
END $$;

-- Step 7: Add foreign key constraint
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
