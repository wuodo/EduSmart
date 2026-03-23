-- CreateTable
CREATE TABLE "followup_comments" (
    "id" SERIAL NOT NULL,
    "followupId" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "followup_comments" ADD CONSTRAINT "followup_comments_followupId_fkey" FOREIGN KEY ("followupId") REFERENCES "followups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
