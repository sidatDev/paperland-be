-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferences" JSONB DEFAULT '{}',
ADD COLUMN     "profile_picture_url" TEXT;
