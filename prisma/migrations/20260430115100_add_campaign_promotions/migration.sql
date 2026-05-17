-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('GENERAL', 'FLASH_SALE', 'CLEARANCE', 'BULK');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('ALL', 'CATEGORY', 'BRAND', 'PRODUCT');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_title" TEXT,
    "display_subtitle" TEXT,
    "description" TEXT,
    "discount_type" TEXT NOT NULL,
    "target_product_id" TEXT,
    "target_category_id" TEXT,
    "target_brand_id" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "max_uses_total" INTEGER,
    "max_uses_per_user" INTEGER,
    "current_uses" INTEGER NOT NULL DEFAULT 0,
    "customer_segment" TEXT NOT NULL DEFAULT 'ALL',
    "min_order_value" DECIMAL(10,2),
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "show_on_banner" BOOLEAN NOT NULL DEFAULT false,
    "banner_image" TEXT,
    "banner_color" TEXT,
    "badge_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "age_threshold_days" INTEGER,
    "background_color" TEXT,
    "banner_image_desktop" TEXT,
    "banner_image_mobile" TEXT,
    "campaign_type" "CampaignType" NOT NULL DEFAULT 'GENERAL',
    "cta_link" TEXT,
    "cta_text" TEXT,
    "display_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_auto_apply" BOOLEAN NOT NULL DEFAULT false,
    "show_countdown" BOOLEAN NOT NULL DEFAULT false,
    "stock_threshold" INTEGER,
    "target_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text_color" TEXT,
    "urgency_message" TEXT,
    "target_type" "TargetType" NOT NULL DEFAULT 'ALL',
    "campaign_hero_image" TEXT,
    "campaign_page_title" TEXT,
    "campaign_primary_color" TEXT,
    "campaign_secondary_color" TEXT,
    "max_discount" DECIMAL(10,2),
    "popup_scope" TEXT,
    "show_view_all_button" BOOLEAN NOT NULL DEFAULT false,
    "layout_type" TEXT DEFAULT 'DEFAULT',
    "slug" TEXT,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_tiers" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_slug_key" ON "promotions"("slug");

-- CreateIndex
CREATE INDEX "promotions_is_active_start_date_end_date_idx" ON "promotions"("is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "promotions_target_type_target_product_id_idx" ON "promotions"("target_type", "target_product_id");

-- CreateIndex
CREATE INDEX "promotions_target_type_target_category_id_idx" ON "promotions"("target_type", "target_category_id");

-- CreateIndex
CREATE INDEX "promotions_target_type_target_brand_id_idx" ON "promotions"("target_type", "target_brand_id");

-- CreateIndex
CREATE INDEX "promotions_show_on_banner_idx" ON "promotions"("show_on_banner");

-- CreateIndex
CREATE INDEX "promotions_campaign_type_idx" ON "promotions"("campaign_type");

-- CreateIndex
CREATE INDEX "promotion_tiers_promotion_id_idx" ON "promotion_tiers"("promotion_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_tiers_promotion_id_min_quantity_key" ON "promotion_tiers"("promotion_id", "min_quantity");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_target_brand_id_fkey" FOREIGN KEY ("target_brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_target_category_id_fkey" FOREIGN KEY ("target_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_tiers" ADD CONSTRAINT "promotion_tiers_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
