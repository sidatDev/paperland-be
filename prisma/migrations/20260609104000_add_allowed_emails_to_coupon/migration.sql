-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "allowed_emails" TEXT[] DEFAULT ARRAY[]::TEXT[];
