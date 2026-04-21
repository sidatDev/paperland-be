-- AlterTable
ALTER TABLE "product_import_logs" 
ADD COLUMN     "added" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "errors_json" JSONB,
ADD COLUMN     "failed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_path" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'UPSERT',
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockMode" TEXT NOT NULL DEFAULT 'OVERWRITE',
ADD COLUMN     "total_rows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN "normalized_name" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "brands_normalized_name_key" ON "brands"("normalized_name");

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "normalized_name" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "categories_normalized_name_key" ON "categories"("normalized_name");

-- CreateIndex
CREATE INDEX "product_import_logs_created_at_idx" ON "product_import_logs"("created_at");

-- CreateIndex
CREATE INDEX "product_import_logs_status_idx" ON "product_import_logs"("status");
