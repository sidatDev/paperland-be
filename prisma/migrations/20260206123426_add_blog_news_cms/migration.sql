/*
  Warnings:

  - A unique constraint covering the columns `[user_id,status]` on the table `carts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "carts_guest_token_key";

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "price_snapshot" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "cms_pages" ALTER COLUMN "schema_json" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN     "backup_s3_endpoint" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otp_code" TEXT,
ADD COLUMN     "otp_expiry" TIMESTAMP(3),
ADD COLUMN     "phone_country_code" TEXT;

-- CreateTable
CREATE TABLE "b2b_company_details" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "registration_country" TEXT NOT NULL,
    "tax_id" TEXT NOT NULL,
    "registration_date" TIMESTAMP(3) NOT NULL,
    "company_address" TEXT NOT NULL,
    "registration_proof_url" TEXT NOT NULL,
    "doing_business_as" TEXT,
    "primary_contact_name" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_country_code" TEXT NOT NULL,
    "billing_email" TEXT NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "ap_contact_name" TEXT NOT NULL,
    "ap_phone" TEXT NOT NULL,
    "ap_country_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_company_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "featured_image_url" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "category_id" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "author_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "b2b_company_details_user_id_key" ON "b2b_company_details"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "blog_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_category_id_idx" ON "blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "carts_guest_token_idx" ON "carts"("guest_token");

-- CreateIndex
CREATE INDEX "carts_user_id_status_idx" ON "carts"("user_id", "status");

-- CreateIndex
CREATE INDEX "carts_status_idx" ON "carts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carts_user_id_status_key" ON "carts"("user_id", "status");

-- AddForeignKey
ALTER TABLE "b2b_company_details" ADD CONSTRAINT "b2b_company_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_categories" ADD CONSTRAINT "blog_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
