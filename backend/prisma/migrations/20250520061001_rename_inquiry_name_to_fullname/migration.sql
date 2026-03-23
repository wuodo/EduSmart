/*
  Warnings:

  - You are about to drop the column `name` on the `inquiries` table. All the data in the column will be lost.
  - Added the required column `fullName` to the `inquiries` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "inquiries" DROP COLUMN "name",
ADD COLUMN     "fullName" TEXT NOT NULL;
