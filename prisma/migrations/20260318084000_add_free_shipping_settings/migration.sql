-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN "free_shipping_threshold" DECIMAL(10,2) DEFAULT 2000;
ALTER TABLE "global_settings" ADD COLUMN "free_shipping_message" TEXT DEFAULT 'Orders above Rs. 2,000 automatically qualify for free shipping across Pakistan.';
