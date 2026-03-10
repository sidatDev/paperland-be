-- AlterTable
ALTER TABLE "discount_tiers" ADD COLUMN "exempt_skus" TEXT[] DEFAULT ARRAY[]::TEXT[];
