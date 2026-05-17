import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting direct DB migration...');
  
  try {
    // 1. Add recovery_email_count column
    console.log('Adding "recovery_email_count" column...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "recovery_email_count" INTEGER DEFAULT 0 NOT NULL;`
    );
    console.log('Successfully added "recovery_email_count".');

    // 2. Add last_recovery_email_at column
    console.log('Adding "last_recovery_email_at" column...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "last_recovery_email_at" TIMESTAMP WITH TIME ZONE;`
    );
    console.log('Successfully added "last_recovery_email_at".');

    console.log('Database migration completed successfully! 🎉');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
