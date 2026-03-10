-- AlterTable
ALTER TABLE "b2b_profiles" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;
