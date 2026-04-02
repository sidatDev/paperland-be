-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';
