-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_iban" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "bank_swift_code" TEXT;

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WALLET',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "instructions" TEXT,
    "fee_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fee_fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_identifier_key" ON "payment_gateways"("identifier");
