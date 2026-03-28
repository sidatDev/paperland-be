-- CreateTable
CREATE TABLE "product_relations" (
    "id" TEXT NOT NULL,
    "source_product_id" TEXT NOT NULL,
    "target_product_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "is_manual" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_relations_source_product_id_type_idx" ON "product_relations"("source_product_id", "type");

-- CreateIndex
CREATE INDEX "product_relations_target_product_id_idx" ON "product_relations"("target_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_relations_source_product_id_target_product_id_type_key" ON "product_relations"("source_product_id", "target_product_id", "type");

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_source_product_id_fkey" FOREIGN KEY ("source_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relations" ADD CONSTRAINT "product_relations_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
