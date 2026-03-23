/*
  Warnings:

  - A unique constraint covering the columns `[studentPhone]` on the table `students` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "students" ADD COLUMN     "studentPhone" TEXT,
ALTER COLUMN "nationalId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_studentPhone_key" ON "students"("studentPhone");
