-- AlterTable
ALTER TABLE "orders" DROP COLUMN IF EXISTS "expires_at";

-- AlterTable
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_bank_account_id_fkey";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "bank_account_id";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "reference_number";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "proof_url";

-- AlterTable
ALTER TABLE "payment_rules" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
ALTER TABLE "payment_rules" ALTER COLUMN "gateway_id" DROP NOT NULL;

-- Re-add the Foreign Key for gateway_id as nullable
ALTER TABLE "payment_rules" DROP CONSTRAINT IF EXISTS "payment_rules_gateway_id_fkey";
ALTER TABLE "payment_rules" ADD CONSTRAINT "payment_rules_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE SET NULL ON UPDATE CASCADE;
