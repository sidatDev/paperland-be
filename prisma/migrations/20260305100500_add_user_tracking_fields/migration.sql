-- AlterTable
ALTER TABLE "users" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "last_password_changed_at" TIMESTAMP(3),
ADD COLUMN     "locked_at" TIMESTAMP(3);
