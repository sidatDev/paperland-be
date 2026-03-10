/*
  Warnings:

  - You are about to drop the column `metadata` on the `audit_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "metadata",
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "user_agent" TEXT,
ALTER COLUMN "details" DROP DEFAULT,
ALTER COLUMN "entity_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" TEXT NOT NULL,
    "internal_name" TEXT NOT NULL,
    "display_title" TEXT,
    "subtitle" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GRID',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cta_label" TEXT,
    "cta_link" TEXT,
    "styles" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_section_items" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "product_id" TEXT,
    "custom_title" TEXT,
    "custom_image" TEXT,
    "custom_link" TEXT,
    "is_featured_large" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_section_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "homepage_section_items" ADD CONSTRAINT "homepage_section_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "homepage_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homepage_section_items" ADD CONSTRAINT "homepage_section_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
