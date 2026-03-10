-- AlterTable
ALTER TABLE "b2b_profiles" ADD COLUMN     "discount_tier_id" TEXT;

-- CreateTable
CREATE TABLE "discount_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_discount_overrides" (
    "id" TEXT NOT NULL,
    "b2b_profile_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_discount_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_tiers_name_key" ON "discount_tiers"("name");

-- CreateIndex
CREATE INDEX "product_discount_overrides_b2b_profile_id_idx" ON "product_discount_overrides"("b2b_profile_id");

-- CreateIndex
CREATE INDEX "product_discount_overrides_product_id_idx" ON "product_discount_overrides"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_discount_overrides_b2b_profile_id_product_id_key" ON "product_discount_overrides"("b2b_profile_id", "product_id");

-- CreateIndex
CREATE INDEX "b2b_profiles_discount_tier_id_idx" ON "b2b_profiles"("discount_tier_id");

-- AddForeignKey
ALTER TABLE "b2b_profiles" ADD CONSTRAINT "b2b_profiles_discount_tier_id_fkey" FOREIGN KEY ("discount_tier_id") REFERENCES "discount_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discount_overrides" ADD CONSTRAINT "product_discount_overrides_b2b_profile_id_fkey" FOREIGN KEY ("b2b_profile_id") REFERENCES "b2b_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_discount_overrides" ADD CONSTRAINT "product_discount_overrides_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

