-- AlterTable
ALTER TABLE "orders" ADD COLUMN "shipper_code" TEXT,
ADD COLUMN "shipper_region" TEXT,
ADD COLUMN "tracking_timeline" JSONB;
