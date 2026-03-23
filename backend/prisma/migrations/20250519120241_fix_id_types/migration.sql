/*
  Warnings:

  - The primary key for the `AcademicProgress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `AcademicProgress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Attendance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Document` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Fee` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Fee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Notification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Timetable` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Timetable` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Unit` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Unit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `students` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `studentId` on the `AcademicProgress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `studentId` on the `Attendance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `unitId` on the `Attendance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `studentId` on the `Document` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `studentId` on the `Fee` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `studentId` on the `Notification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `studentId` on the `Timetable` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `unitId` on the `Timetable` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `A` on the `_StudentToUnit` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `B` on the `_StudentToUnit` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "AcademicProgress" DROP CONSTRAINT "AcademicProgress_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Fee" DROP CONSTRAINT "Fee_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Timetable" DROP CONSTRAINT "Timetable_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Timetable" DROP CONSTRAINT "Timetable_unitId_fkey";

-- DropForeignKey
ALTER TABLE "_StudentToUnit" DROP CONSTRAINT "_StudentToUnit_A_fkey";

-- DropForeignKey
ALTER TABLE "_StudentToUnit" DROP CONSTRAINT "_StudentToUnit_B_fkey";

-- AlterTable
ALTER TABLE "AcademicProgress" DROP CONSTRAINT "AcademicProgress_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
ADD CONSTRAINT "AcademicProgress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
DROP COLUMN "unitId",
ADD COLUMN     "unitId" INTEGER NOT NULL,
ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Document" DROP CONSTRAINT "Document_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Fee" DROP CONSTRAINT "Fee_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
ADD CONSTRAINT "Fee_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Timetable" DROP CONSTRAINT "Timetable_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "studentId",
ADD COLUMN     "studentId" INTEGER NOT NULL,
DROP COLUMN "unitId",
ADD COLUMN     "unitId" INTEGER NOT NULL,
ADD CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Unit_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "_StudentToUnit" DROP COLUMN "A",
ADD COLUMN     "A" INTEGER NOT NULL,
DROP COLUMN "B",
ADD COLUMN     "B" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "students" DROP CONSTRAINT "students_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicProgress_studentId_key" ON "AcademicProgress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "_StudentToUnit_AB_unique" ON "_StudentToUnit"("A", "B");

-- CreateIndex
CREATE INDEX "_StudentToUnit_B_index" ON "_StudentToUnit"("B");

-- AddForeignKey
ALTER TABLE "AcademicProgress" ADD CONSTRAINT "AcademicProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentToUnit" ADD CONSTRAINT "_StudentToUnit_A_fkey" FOREIGN KEY ("A") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentToUnit" ADD CONSTRAINT "_StudentToUnit_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
