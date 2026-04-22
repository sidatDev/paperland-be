-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_manual_logistics" BOOLEAN NOT NULL DEFAULT false;
