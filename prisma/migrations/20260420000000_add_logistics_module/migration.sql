-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT IF EXISTS "addresses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "flash_sale_items" DROP CONSTRAINT IF EXISTS "flash_sale_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_user_id_fkey";

-- DropForeignKey
ALTER TABLE "rfq_items" DROP CONSTRAINT IF EXISTS "rfq_items_rfq_id_fkey";

-- DropForeignKey
ALTER TABLE "rfqs" DROP CONSTRAINT IF EXISTS "rfqs_shipping_address_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_user_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "idx_orders_guest_token";

-- DropIndex
DROP INDEX IF EXISTS "idx_orders_is_guest";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN IF EXISTS "shipper_label_url",
ADD COLUMN     "courier_provider_id" TEXT,
ADD COLUMN     "delivery_status" TEXT,
ADD COLUMN     "fulfillment_warehouse_id" TEXT,
ADD COLUMN     "logistics_type" TEXT,
ADD COLUMN     "rider_id" TEXT,
ADD COLUMN     "tracking_response_json" JSONB,
ADD COLUMN     "tracking_status" TEXT,
ALTER COLUMN "guest_email" SET DATA TYPE TEXT,
ALTER COLUMN "guest_phone" SET DATA TYPE TEXT,
ALTER COLUMN "is_guest_order" SET NOT NULL,
ALTER COLUMN "guest_token" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "rfq_items" DROP COLUMN IF EXISTS "specifications",
DROP COLUMN IF EXISTS "target_price";

-- AlterTable
ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "attachments",
DROP COLUMN IF EXISTS "description",
DROP COLUMN IF EXISTS "expected_delivery_date",
DROP COLUMN IF EXISTS "preferred_payment_method",
DROP COLUMN IF EXISTS "shipping_address_id",
DROP COLUMN IF EXISTS "title",
DROP COLUMN IF EXISTS "urgency",
DROP COLUMN IF EXISTS "valid_until";

-- CreateTable
CREATE TABLE "courier_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'PK',
    "tracking_url" TEXT,
    "api_config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cnic" TEXT,
    "vehicle_info" TEXT,
    "region" TEXT NOT NULL DEFAULT 'PK',
    "city" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'PK',
    "city" TEXT,
    "logistics_type" TEXT NOT NULL,
    "min_order_value" DECIMAL(12,2),
    "max_order_value" DECIMAL(12,2),
    "courier_provider_id" TEXT,
    "warehouse_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_logs" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "raw_response" JSONB,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courier_providers_code_key" ON "courier_providers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "riders_cnic_key" ON "riders"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rules_name_key" ON "shipping_rules"("name");

-- CreateIndex
CREATE INDEX "tracking_logs_order_id_idx" ON "tracking_logs"("order_id");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_provider_id_fkey" FOREIGN KEY ("courier_provider_id") REFERENCES "courier_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_logs" ADD CONSTRAINT "tracking_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
