-- CreateTable
CREATE TABLE IF NOT EXISTS "grades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "grades_name_key" ON "grades"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "grades_slug_key" ON "grades"("slug");

-- AlterTable
ALTER TABLE "grades" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'WAREHOUSE';
