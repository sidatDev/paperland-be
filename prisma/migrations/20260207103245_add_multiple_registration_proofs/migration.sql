-- AlterTable
ALTER TABLE "b2b_company_details" ALTER COLUMN "registration_proof_url" DROP NOT NULL;
ALTER TABLE "b2b_company_details" ADD COLUMN "registration_proof_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
