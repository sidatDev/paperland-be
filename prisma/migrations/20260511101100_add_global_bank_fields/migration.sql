-- AlterTable
ALTER TABLE "bank_accounts" ADD COLUMN "bank_address" TEXT,
ADD COLUMN "beneficiary_address" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "currency_id" TEXT,
ADD COLUMN "ifsc_code" TEXT,
ADD COLUMN "routing_number" TEXT,
ADD COLUMN "sort_code" TEXT,
ADD COLUMN "swift_code" TEXT;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
