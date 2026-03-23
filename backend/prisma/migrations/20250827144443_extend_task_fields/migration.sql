-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "reminderAt" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'call',
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'team';
