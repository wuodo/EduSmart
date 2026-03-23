/*
  Warnings:

  - You are about to drop the column `author` on the `followup_comments` table. All the data in the column will be lost.
  - You are about to drop the column `isInternal` on the `followup_comments` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `followup_comments` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `followup_comments` table. All the data in the column will be lost.
  - Added the required column `comment` to the `followup_comments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "followup_comments" DROP COLUMN "author",
DROP COLUMN "isInternal",
DROP COLUMN "message",
DROP COLUMN "updatedAt",
ADD COLUMN     "comment" TEXT NOT NULL,
ADD COLUMN     "createdBy" TEXT;

-- AlterTable
ALTER TABLE "followups" ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "assignedTo" DROP NOT NULL,
ALTER COLUMN "createdBy" DROP NOT NULL,
ALTER COLUMN "paymentStatus" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "kcseGrade" TEXT NOT NULL DEFAULT 'Unknown';

-- CreateTable
CREATE TABLE "inquiry_details" (
    "id" SERIAL NOT NULL,
    "inquiryId" INTEGER NOT NULL,
    "idOrPassport" TEXT,
    "county" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_details_inquiryId_key" ON "inquiry_details"("inquiryId");

-- AddForeignKey
ALTER TABLE "inquiry_details" ADD CONSTRAINT "inquiry_details_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
