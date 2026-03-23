-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "dropoffStage" TEXT,
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "nextFollowupAt" TIMESTAMP(3),
ADD COLUMN     "recommendation" TEXT,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sentiment" TEXT;
