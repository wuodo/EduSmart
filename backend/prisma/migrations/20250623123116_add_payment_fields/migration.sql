-- AlterTable
ALTER TABLE "followups" ADD COLUMN     "paymentCode" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'Not Paid';

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "paymentCode" TEXT,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'Not Paid';
