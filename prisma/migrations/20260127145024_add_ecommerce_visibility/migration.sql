-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "homepage_section_items" ADD COLUMN     "custom_description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_ecommerce_visible" BOOLEAN NOT NULL DEFAULT true;
