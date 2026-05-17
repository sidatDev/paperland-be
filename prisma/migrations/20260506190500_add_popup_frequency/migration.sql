-- AlterTable
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "popup_frequency_hours" INTEGER DEFAULT 0;
