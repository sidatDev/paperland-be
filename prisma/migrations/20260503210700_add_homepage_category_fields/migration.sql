-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "homepage_image" TEXT,
ADD COLUMN     "homepage_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "show_on_homepage" BOOLEAN NOT NULL DEFAULT false;
