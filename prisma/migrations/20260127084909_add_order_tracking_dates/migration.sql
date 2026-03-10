-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_date" TIMESTAMP(3),
ADD COLUMN     "processing_date" TIMESTAMP(3),
ADD COLUMN     "shipped_date" TIMESTAMP(3);
