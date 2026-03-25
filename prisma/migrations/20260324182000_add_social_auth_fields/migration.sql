-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN     "google_client_id" TEXT,
ADD COLUMN     "google_client_secret" TEXT,
ADD COLUMN     "facebook_app_id" TEXT,
ADD COLUMN     "facebook_app_secret" TEXT,
ADD COLUMN     "social_auth_enabled" BOOLEAN NOT NULL DEFAULT false;
