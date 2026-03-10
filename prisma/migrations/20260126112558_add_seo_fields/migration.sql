/*
  Warnings:

  - You are about to drop the column `country` on the `addresses` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `erp_product_id` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `prices` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `transactions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `brands` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[erp_order_id]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `country_id` to the `addresses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency_id` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency_id` to the `prices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `prices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currency_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "prices" DROP CONSTRAINT "prices_product_id_fkey";

-- DropIndex
DROP INDEX "prices_product_id_idx";

-- DropIndex
DROP INDEX "prices_product_id_price_key";

-- AlterTable
ALTER TABLE "addresses" DROP COLUMN "country",
ADD COLUMN     "country_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "b2b_profiles" ADD COLUMN     "currency_id" TEXT;

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "parent_id" TEXT;

-- AlterTable
ALTER TABLE "cms_pages" ADD COLUMN     "featured_image_url" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "inventory_snapshot" JSONB,
ADD COLUMN     "pricing_snapshot" JSONB,
ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billing_snapshot" JSONB,
ADD COLUMN     "currency_id" TEXT NOT NULL,
ADD COLUMN     "erp_order_id" TEXT,
ADD COLUMN     "erp_sync_log" JSONB,
ADD COLUMN     "erp_sync_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "notes" JSONB,
ADD COLUMN     "order_context" JSONB,
ADD COLUMN     "payment_details" JSONB,
ADD COLUMN     "pricing_summary" JSONB,
ADD COLUMN     "shipping_details" JSONB,
ADD COLUMN     "shipping_snapshot" JSONB;

-- AlterTable
ALTER TABLE "prices" DROP COLUMN "created_at",
DROP COLUMN "currency",
DROP COLUMN "erp_product_id",
DROP COLUMN "price",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency_id" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "priceRetail" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priceSpecial" DECIMAL(10,2),
ADD COLUMN     "priceWholesale" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "groupNumber" TEXT,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seo" JSONB,
ADD COLUMN     "volume" TEXT,
ADD COLUMN     "width" TEXT;

-- AlterTable
ALTER TABLE "shipping_rates" ADD COLUMN     "min_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "volume_increment" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "weight_increment" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shipping_zones" ADD COLUMN     "country_id" TEXT,
ADD COLUMN     "volumetric_divisor" INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "currency",
ADD COLUMN     "currency_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency_id" TEXT NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from_currency_id" TEXT NOT NULL,
    "to_currency_id" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_industries" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "industry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_sync_logs" (
    "id" TEXT NOT NULL,
    "triggered_by" TEXT,
    "status" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performed_by" TEXT,
    "details" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_logs" (
    "id" TEXT NOT NULL,
    "page_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predefined_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sql_query" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predefined_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_logs" (
    "id" TEXT NOT NULL,
    "report_id" TEXT,
    "user_id" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL,
    "store_name" TEXT NOT NULL DEFAULT 'Filters Expert',
    "contact_email" TEXT NOT NULL DEFAULT 'admin@filtersexpert.com',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT true,
    "smtp_host" TEXT NOT NULL DEFAULT 'smtp.sendgrid.net',
    "smtp_port" INTEGER NOT NULL DEFAULT 587,
    "smtp_encryption" TEXT NOT NULL DEFAULT 'TLS',
    "smtp_user" TEXT,
    "smtp_pass" TEXT,
    "sender_name" TEXT NOT NULL DEFAULT 'Filters Expert Support',
    "sender_email" TEXT NOT NULL DEFAULT 'no-reply@filtersexpert.com',
    "backup_s3_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_s3_bucket" TEXT,
    "backup_s3_region" TEXT,
    "backup_s3_access_key" TEXT,
    "backup_s3_secret_key" TEXT,
    "backup_s3_path" TEXT,
    "backup_ftp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "backup_ftp_host" TEXT,
    "backup_ftp_port" INTEGER NOT NULL DEFAULT 21,
    "backup_ftp_user" TEXT,
    "backup_ftp_pass" TEXT,
    "backup_ftp_path" TEXT,
    "seo_title" TEXT NOT NULL DEFAULT 'Filters Expert',
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "seo_scripts_header" TEXT,
    "seo_scripts_body" TEXT,
    "sitemap_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE INDEX "countries_currency_id_idx" ON "countries"("currency_id");

-- CreateIndex
CREATE INDEX "exchange_rates_from_currency_id_idx" ON "exchange_rates"("from_currency_id");

-- CreateIndex
CREATE INDEX "exchange_rates_to_currency_id_idx" ON "exchange_rates"("to_currency_id");

-- CreateIndex
CREATE INDEX "exchange_rates_valid_from_valid_to_idx" ON "exchange_rates"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_id_to_currency_id_valid_from_key" ON "exchange_rates"("from_currency_id", "to_currency_id", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "industries_name_key" ON "industries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "industries_slug_key" ON "industries"("slug");

-- CreateIndex
CREATE INDEX "product_industries_product_id_idx" ON "product_industries"("product_id");

-- CreateIndex
CREATE INDEX "product_industries_industry_id_idx" ON "product_industries"("industry_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_industries_product_id_industry_id_key" ON "product_industries"("product_id", "industry_id");

-- CreateIndex
CREATE INDEX "batches_product_id_idx" ON "batches"("product_id");

-- CreateIndex
CREATE INDEX "batches_is_active_idx" ON "batches"("is_active");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs"("performed_by");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_url_key" ON "media_assets"("url");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_key_key" ON "media_assets"("key");

-- CreateIndex
CREATE INDEX "addresses_country_id_idx" ON "addresses"("country_id");

-- CreateIndex
CREATE INDEX "b2b_profiles_currency_id_idx" ON "b2b_profiles"("currency_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_erp_order_id_key" ON "orders"("erp_order_id");

-- CreateIndex
CREATE INDEX "orders_currency_id_idx" ON "orders"("currency_id");

-- CreateIndex
CREATE INDEX "prices_currency_id_idx" ON "prices"("currency_id");

-- CreateIndex
CREATE INDEX "shipping_zones_country_id_idx" ON "shipping_zones"("country_id");

-- CreateIndex
CREATE INDEX "transactions_currency_id_idx" ON "transactions"("currency_id");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_from_currency_id_fkey" FOREIGN KEY ("from_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_id_fkey" FOREIGN KEY ("to_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_profiles" ADD CONSTRAINT "b2b_profiles_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industries" ADD CONSTRAINT "product_industries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industries" ADD CONSTRAINT "product_industries_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_logs" ADD CONSTRAINT "cms_logs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_logs" ADD CONSTRAINT "cms_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_logs" ADD CONSTRAINT "report_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "predefined_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_logs" ADD CONSTRAINT "report_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
