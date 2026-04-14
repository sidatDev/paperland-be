-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "registration_country" TEXT,
    "tax_id" TEXT,
    "registration_date" TIMESTAMP(3),
    "company_address" TEXT,
    "registration_proof_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doing_business_as" TEXT,
    "primary_contact_name" TEXT,
    "job_title" TEXT,
    "contact_phone" TEXT,
    "contact_country_code" TEXT,
    "billing_email" TEXT,
    "shipping_address" TEXT,
    "ap_contact_name" TEXT,
    "ap_phone" TEXT,
    "ap_country_code" TEXT,
    "authorized_rep_email" TEXT,
    "authorized_rep_name" TEXT,
    "registered_legal_entity" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),

    CONSTRAINT "catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_variants" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_pricing" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "custom_price" DECIMAL(10,2) NOT NULL,
    "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_catalogs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_catalogs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "company_id" TEXT;
ALTER TABLE "b2b_profiles" ADD COLUMN "company_id" TEXT;
ALTER TABLE "cart_items" ADD COLUMN "catalog_id" TEXT, ADD COLUMN "status" TEXT NOT NULL DEFAULT 'VALID';

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_catalog_id_product_id_key" ON "catalog_products"("catalog_id", "product_id");
CREATE UNIQUE INDEX "catalog_variants_catalog_id_variant_id_key" ON "catalog_variants"("catalog_id", "variant_id");
CREATE UNIQUE INDEX "catalog_pricing_catalog_id_variant_id_key" ON "catalog_pricing"("catalog_id", "variant_id");
CREATE UNIQUE INDEX "company_catalogs_company_id_catalog_id_key" ON "company_catalogs"("company_id", "catalog_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "b2b_profiles" ADD CONSTRAINT "b2b_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_variants" ADD CONSTRAINT "catalog_variants_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_pricing" ADD CONSTRAINT "catalog_pricing_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_pricing" ADD CONSTRAINT "catalog_pricing_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_catalogs" ADD CONSTRAINT "company_catalogs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_catalogs" ADD CONSTRAINT "company_catalogs_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
