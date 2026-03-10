import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTableStructure() {
  try {
    console.log('🔍 Analyzing audit_logs table...\n');

    // Get all columns
    const columns: any = await prisma.$queryRaw`
      SELECT 
        column_name, 
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position;
    `;

    console.log('📋 Columns in audit_logs table:');
    console.table(columns);

    // Try to fetch a sample record
    console.log('\n📊 Sample records from audit_logs:');
    const sampleRecords = await prisma.$queryRaw`
      SELECT * FROM audit_logs LIMIT 3;
    `;
    console.log(sampleRecords);

    // Count records
    const count: any = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM audit_logs;
    `;
    console.log(`\n✅ Total records: ${count[0].total}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableStructure();
