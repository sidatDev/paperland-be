-- AlterTable
ALTER TABLE "pending_registrations" ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "zip_code" TEXT;
