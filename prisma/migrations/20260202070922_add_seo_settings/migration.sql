-- AlterTable
ALTER TABLE "global_settings" ADD COLUMN     "seo_description" TEXT,
ADD COLUMN     "seo_keywords" TEXT,
ADD COLUMN     "seo_scripts_body" TEXT,
ADD COLUMN     "seo_scripts_header" TEXT,
ADD COLUMN     "seo_title" TEXT,
ADD COLUMN     "sitemap_url" TEXT;
