-- AlterTable: Add new columns to coupons table
ALTER TABLE "coupons" ADD COLUMN "title" TEXT;
ALTER TABLE "coupons" ADD COLUMN "description" TEXT;
ALTER TABLE "coupons" ADD COLUMN "usage_limit_per_customer" INTEGER;
ALTER TABLE "coupons" ADD COLUMN "budget_cap" DECIMAL(12,2);
ALTER TABLE "coupons" ADD COLUMN "total_discount_given" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "coupons" ADD COLUMN "application_type" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "coupons" ADD COLUMN "customer_type" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "coupons" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "coupons" ADD COLUMN "is_stackable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: coupon_products junction table
CREATE TABLE "coupon_products" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "coupon_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: coupon_categories junction table
CREATE TABLE "coupon_categories" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "coupon_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_products_coupon_id_product_id_key" ON "coupon_products"("coupon_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_categories_coupon_id_category_id_key" ON "coupon_categories"("coupon_id", "category_id");

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_products" ADD CONSTRAINT "coupon_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_categories" ADD CONSTRAINT "coupon_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
