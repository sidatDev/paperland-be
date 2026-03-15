-- AlterTable
ALTER TABLE "products" ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "variant_attributes" JSONB,
ADD COLUMN     "variant_options" JSONB;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
