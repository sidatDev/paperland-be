/*
  Warnings:

  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `seo_description` on the `global_settings` table. All the data in the column will be lost.
  - You are about to drop the column `seo_keywords` on the `global_settings` table. All the data in the column will be lost.
  - You are about to drop the column `seo_scripts_body` on the `global_settings` table. All the data in the column will be lost.
  - You are about to drop the column `seo_scripts_header` on the `global_settings` table. All the data in the column will be lost.
  - You are about to drop the column `seo_title` on the `global_settings` table. All the data in the column will be lost.
  - You are about to drop the column `sitemap_url` on the `global_settings` table. All the data in the column will be lost.
  - Added the required column `entity_id` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entity_type` to the `audit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "audit_logs_entityType_entityId_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entityId",
DROP COLUMN "entityType",
ADD COLUMN     "entity_id" TEXT NOT NULL,
ADD COLUMN     "entity_type" TEXT NOT NULL,
ALTER COLUMN "details" SET DEFAULT '{}',
ALTER COLUMN "metadata" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "global_settings" DROP COLUMN "seo_description",
DROP COLUMN "seo_keywords",
DROP COLUMN "seo_scripts_body",
DROP COLUMN "seo_scripts_header",
DROP COLUMN "seo_title",
DROP COLUMN "sitemap_url";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courier_partner" TEXT,
ADD COLUMN     "credit_apr" DECIMAL(5,2),
ADD COLUMN     "credit_term" INTEGER,
ADD COLUMN     "delivery_method" TEXT,
ADD COLUMN     "down_payment" DECIMAL(10,2),
ADD COLUMN     "estimated_delivery_date" TIMESTAMP(3),
ADD COLUMN     "transaction_ref" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "license_number" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
