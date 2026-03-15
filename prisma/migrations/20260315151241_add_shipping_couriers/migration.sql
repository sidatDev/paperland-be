-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipper_booking_id" TEXT,
ADD COLUMN     "shipper_label_url" TEXT;

-- CreateTable
CREATE TABLE "shipping_couriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_couriers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_couriers_name_key" ON "shipping_couriers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_couriers_identifier_key" ON "shipping_couriers"("identifier");
