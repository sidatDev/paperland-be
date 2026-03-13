/*
  Warnings:

  - You are about to drop the column `erp_order_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `erp_sync_log` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `erp_sync_status` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `erp_product_id` on the `stocks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "orders_erp_order_id_key";

-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN     "store_slogan" TEXT DEFAULT 'School Se Office Tak',
ALTER COLUMN "store_name" SET DEFAULT 'Paperland',
ALTER COLUMN "contact_email" SET DEFAULT 'admin@paperland.com.pk',
ALTER COLUMN "sender_name" SET DEFAULT 'Paperland Support',
ALTER COLUMN "sender_email" SET DEFAULT 'no-reply@paperland.com.pk';

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "erp_order_id",
DROP COLUMN "erp_sync_log",
DROP COLUMN "erp_sync_status";

-- AlterTable
ALTER TABLE "stocks" DROP COLUMN "erp_product_id";

-- AlterTable
ALTER TABLE "warehouses" ALTER COLUMN "country" SET DEFAULT 'PK';

-- Update existing GlobalSettings row to Paperland branding
UPDATE global_settings SET 
  store_name = 'Paperland',
  contact_email = 'admin@paperland.com.pk',
  sender_name = 'Paperland Support',
  sender_email = 'no-reply@paperland.com.pk';
