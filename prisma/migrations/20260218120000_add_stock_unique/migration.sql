-- CreateIndex
CREATE UNIQUE INDEX "stocks_product_id_warehouse_id_key" ON "stocks"("product_id", "warehouse_id");
