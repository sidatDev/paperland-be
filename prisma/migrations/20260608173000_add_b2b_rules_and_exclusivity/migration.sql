-- AlterTable
ALTER TABLE "b2b_profiles" ADD COLUMN "is_catalog_exclusive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "b2b_assignment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email_domain" TEXT,
    "company_name_pattern" TEXT,
    "catalog_id" TEXT,
    "discount_tier_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "b2b_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "b2b_assignment_rules" ADD CONSTRAINT "b2b_assignment_rules_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_assignment_rules" ADD CONSTRAINT "b2b_assignment_rules_discount_tier_id_fkey" FOREIGN KEY ("discount_tier_id") REFERENCES "discount_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
