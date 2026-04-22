-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cities" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_rules" (
    "id" TEXT NOT NULL,
    "zone_id" TEXT,
    "gateway_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_order_value" DECIMAL(12,2),
    "max_order_value" DECIMAL(12,2),
    "extra_charge" DECIMAL(10,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_title" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "iban" TEXT,
    "branch" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_zones_name_key" ON "payment_zones"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_rules_zone_id_idx" ON "payment_rules"("zone_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_rules_gateway_id_idx" ON "payment_rules"("gateway_id");

-- AddForeignKey
ALTER TABLE "payment_rules" ADD CONSTRAINT "payment_rules_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "payment_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_rules" ADD CONSTRAINT "payment_rules_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add columns to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- Add columns to transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "bank_account_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reference_number" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "proof_url" TEXT;

-- AddForeignKey for transactions
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
