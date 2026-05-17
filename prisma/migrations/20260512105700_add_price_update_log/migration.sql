-- CreateTable
CREATE TABLE "price_update_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price_type" TEXT NOT NULL DEFAULT 'RETAIL',
    "oldPrice" DECIMAL(10,2) NOT NULL,
    "newPrice" DECIMAL(10,2) NOT NULL,
    "performed_by" TEXT,
    "user_name" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_update_logs_product_id_idx" ON "price_update_logs"("product_id");

-- CreateIndex
CREATE INDEX "price_update_logs_created_at_idx" ON "price_update_logs"("created_at");

-- AddForeignKey
ALTER TABLE "price_update_logs" ADD CONSTRAINT "price_update_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_update_logs" ADD CONSTRAINT "price_update_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
