-- AlterTable
ALTER TABLE "price_update_logs" ADD COLUMN "batch_id" TEXT;

-- CreateIndex
CREATE INDEX "price_update_logs_batch_id_idx" ON "price_update_logs"("batch_id");
