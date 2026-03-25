-- AlterTable
ALTER TABLE "grades" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'WAREHOUSE';
