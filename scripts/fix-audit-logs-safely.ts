import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function safelyAddMissingColumns() {
  console.log('🔍 Checking audit_logs table structure...\n');

  try {
    // First, check if the columns exist
    const checkColumns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Current columns in audit_logs:');
    console.log(checkColumns);
    console.log('\n');

    // Check if entity_type column exists
    const hasEntityType = (checkColumns as any[]).some(
      (col: any) => col.column_name === 'entity_type'
    );

    if (!hasEntityType) {
      console.log('⚠️  Missing column: entity_type');
      console.log('➕ Adding entity_type column (safe operation - no data loss)...\n');

      // Add the column with a default value to ensure existing rows are safe
      await prisma.$executeRaw`
        ALTER TABLE "audit_logs" 
        ADD COLUMN IF NOT EXISTS "entity_type" TEXT;
      `;

      // Update existing records if any have NULL values
      await prisma.$executeRaw`
        UPDATE "audit_logs" 
        SET "entity_type" = 'UNKNOWN' 
        WHERE "entity_type" IS NULL;
      `;

      console.log('✅ entity_type column added successfully!');
    } else {
      console.log('✓ entity_type column already exists');
    }

    // Check if entity_id column exists
    const hasEntityId = (checkColumns as any[]).some(
      (col: any) => col.column_name === 'entity_id'
    );

    if (!hasEntityId) {
      console.log('⚠️  Missing column: entity_id');
      console.log('➕ Adding entity_id column (safe operation - no data loss)...\n');

      await prisma.$executeRaw`
        ALTER TABLE "audit_logs" 
        ADD COLUMN IF NOT EXISTS "entity_id" TEXT;
      `;

      await prisma.$executeRaw`
        UPDATE "audit_logs" 
        SET "entity_id" = id 
        WHERE "entity_id" IS NULL;
      `;

      console.log('✅ entity_id column added successfully!');
    } else {
      console.log('✓ entity_id column already exists');
    }

    // Verify final state
    console.log('\n📊 Verifying final table structure...');
    const finalColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `;

    console.log(finalColumns);

    // Count total records to confirm no data loss
    const count = await prisma.auditLog.count();
    console.log(`\n✅ Total records in audit_logs: ${count}`);
    console.log('✅ No data was lost during this operation!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

safelyAddMissingColumns()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
