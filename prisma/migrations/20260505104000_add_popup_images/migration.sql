-- AlterTable
ALTER TABLE "promotions" 
ADD COLUMN IF NOT EXISTS "popup_image_desktop" TEXT,
ADD COLUMN IF NOT EXISTS "popup_image_mobile" TEXT;
