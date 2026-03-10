-- AlterTable
ALTER TABLE "cms_page_versions" ADD COLUMN     "content_json" JSONB;

-- AlterTable
ALTER TABLE "cms_pages" ADD COLUMN     "content_json" JSONB,
ADD COLUMN     "schema_json" JSONB;
