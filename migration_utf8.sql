-- DropForeignKey
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_promotion_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_promotion_id_fkey";

-- AlterTable
ALTER TABLE "cart_items" DROP COLUMN "promotion_id";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "promotion_id";

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "popup_image_desktop" TEXT,
ADD COLUMN     "popup_image_mobile" TEXT;

