/*
  Warnings:

  - A unique constraint covering the columns `[product_id,price]` on the table `prices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[product_id,location_id]` on the table `stocks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "prices_product_id_price_key" ON "prices"("product_id", "price");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_product_id_location_id_key" ON "stocks"("product_id", "location_id");
