/*
  Warnings:

  - You are about to drop the column `attributes` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `efficiency` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `erp_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `flow_rate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `gasket_id` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `gasket_od` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `groupNumber` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `inner_diameter` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `max_pressure` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `micron_rating` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `outer_diameter` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `seo` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `temperature_range` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `thread_size` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "attributes",
DROP COLUMN "efficiency",
DROP COLUMN "erp_id",
DROP COLUMN "flow_rate",
DROP COLUMN "gasket_id",
DROP COLUMN "gasket_od",
DROP COLUMN "groupNumber",
DROP COLUMN "inner_diameter",
DROP COLUMN "max_pressure",
DROP COLUMN "micron_rating",
DROP COLUMN "outer_diameter",
DROP COLUMN "seo",
DROP COLUMN "temperature_range",
DROP COLUMN "thread_size",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft';

-- CreateTable
CREATE TABLE "b2b_team_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "b2b_profile_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "order_approval_limit" DECIMAL(12,2),
    "requires_admin_approval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "b2b_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_catalog_items" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "custom_price" DECIMAL(10,2) NOT NULL,
    "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
    "buyer_part_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_catalogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "b2b_profile_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "b2b_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "document_url" TEXT,
    "rfq_id" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "b2b_team_members_user_id_key" ON "b2b_team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_catalog_items_catalog_id_product_id_key" ON "custom_catalog_items"("catalog_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_rfq_id_key" ON "purchase_orders"("rfq_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_order_id_key" ON "purchase_orders"("order_id");

-- AddForeignKey
ALTER TABLE "b2b_team_members" ADD CONSTRAINT "b2b_team_members_b2b_profile_id_fkey" FOREIGN KEY ("b2b_profile_id") REFERENCES "b2b_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_team_members" ADD CONSTRAINT "b2b_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_catalog_items" ADD CONSTRAINT "custom_catalog_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "custom_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_catalog_items" ADD CONSTRAINT "custom_catalog_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_catalogs" ADD CONSTRAINT "custom_catalogs_b2b_profile_id_fkey" FOREIGN KEY ("b2b_profile_id") REFERENCES "b2b_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_b2b_profile_id_fkey" FOREIGN KEY ("b2b_profile_id") REFERENCES "b2b_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
