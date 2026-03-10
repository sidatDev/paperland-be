import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('🔄 Starting database backup...');
  console.log(`📁 Backup will be saved to: ${backupFile}`);

  try {
    // Get database URL from environment
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not found in environment');
    }

    // Parse connection string
    const url = new URL(dbUrl);
    const user = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.substring(1);

    console.log(`📊 Database: ${database}`);
    console.log(`🖥️  Host: ${host}:${port}`);

    // Use pg_dump to create backup
    const pgDumpCommand = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${backupFile}"`;
    
    // Set password as environment variable
    process.env.PGPASSWORD = password;

    await execAsync(pgDumpCommand);

    console.log('✅ Backup completed successfully!');
    console.log(`📦 Backup file: ${backupFile}`);
    console.log(`📏 File size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);
    
    return backupFile;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Run backup
backupDatabase()
  .then(() => {
    console.log('\n✅ Backup process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backup process failed:', error);
    process.exit(1);
  });
