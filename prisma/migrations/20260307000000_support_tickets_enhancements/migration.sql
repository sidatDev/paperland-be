-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "assigned_to_id" TEXT;
ALTER TABLE "support_tickets" ADD COLUMN "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
