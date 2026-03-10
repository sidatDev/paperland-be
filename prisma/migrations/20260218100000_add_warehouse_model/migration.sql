-- CreateTable: warehouses (additive — no existing data affected)
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- AlterTable: stocks — add new optional columns (no data loss, all nullable or have defaults)
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "warehouse_id" TEXT;
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "reserved_qty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "stocks" ADD COLUMN IF NOT EXISTS "reorder_level" INTEGER NOT NULL DEFAULT 10;

-- CreateIndex for warehouse FK on stocks
CREATE INDEX IF NOT EXISTS "stocks_warehouse_id_idx" ON "stocks"("warehouse_id");

-- AddForeignKey: stocks.warehouse_id -> warehouses.id
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed a default warehouse so existing stock entries can be linked
INSERT INTO "warehouses" ("id", "code", "name", "city", "country", "is_active", "is_default", "updated_at")
VALUES ('default-main-warehouse', 'MAIN', 'Main Warehouse', 'Riyadh', 'SA', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Link all existing stock rows (locationId = 'MAIN') to the default warehouse
UPDATE "stocks" SET "warehouse_id" = 'default-main-warehouse' WHERE "warehouse_id" IS NULL;
