-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unit_cost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "total_cost" DECIMAL(12,2),
ADD COLUMN     "total_expenses" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "payment_rules" ALTER COLUMN "paymentType" SET NOT NULL;

-- AlterTable
ALTER TABLE "product_import_logs" DROP COLUMN "details";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cost_price" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillment_warehouse_id_fkey" FOREIGN KEY ("fulfillment_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_rules_courier_provider_id_fkey" FOREIGN KEY ("courier_provider_id") REFERENCES "courier_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
