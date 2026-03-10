-- CreateTable
CREATE TABLE "cross_references" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "target_product_id" TEXT NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'COMPATIBLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cross_references_product_id_target_product_id_relationType_key" ON "cross_references"("product_id", "target_product_id", "relationType");

-- AddForeignKey
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
