-- AlterTable
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "cancel_requested_at" TIMESTAMP(3);
