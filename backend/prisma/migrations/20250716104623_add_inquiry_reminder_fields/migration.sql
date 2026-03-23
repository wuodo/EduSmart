-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "engagementSentiment" TEXT,
ADD COLUMN     "lastReminderResponse" TEXT,
ADD COLUMN     "lastReminderSent" TIMESTAMP(3),
ADD COLUMN     "reminderStatus" TEXT;
