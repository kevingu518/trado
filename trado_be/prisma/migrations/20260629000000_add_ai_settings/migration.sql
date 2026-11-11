-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiModel" VARCHAR(60),
ADD COLUMN     "aiProvider" VARCHAR(20);
