-- AlterTable
ALTER TABLE "Trade" ALTER COLUMN "totalShares" DROP NOT NULL,
ALTER COLUMN "avgPrice" DROP NOT NULL,
ALTER COLUMN "followedDiscipline" SET DEFAULT 'pending',
ALTER COLUMN "followedDiscipline" SET DATA TYPE VARCHAR(20);
