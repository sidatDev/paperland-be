-- AlterTable
ALTER TABLE "shipping_rules" ADD COLUMN     "estimated_days" TEXT,
ADD COLUMN     "base_shipping_cost" DECIMAL(12,2);
