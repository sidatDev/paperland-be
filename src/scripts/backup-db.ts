import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function main() {
  console.log('Starting Database Backup...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const tables = [
    'User', 'Role', 'Permission', 'RolePermission', 'UserPermission',
    'Product', 'Category', 'Brand', 'Industry', 'Price', 'Stock', 'Batch',
    'Order', 'OrderItem', 'OrderStatusHistory', 'Transaction',
    'Address', 'Cart', 'CartItem', 'GlobalSettings', 'Currency', 'Country'
  ];

  const dumpData: any = {};
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pre-checkout-backup-${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  for (const table of tables) {
    try {
      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      if ((prisma as any)[modelName]) {
        console.log(`Dumping table: ${table}...`);
        dumpData[table] = await (prisma as any)[modelName].findMany();
      } else {
        console.warn(`Table ${table} not found in Prisma client.`);
      }
    } catch (err: any) {
      console.error(`Failed to dump ${table}:`, err.message);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(dumpData, null, 2));
  console.log(`\nBackup completed successfully!`);
  console.log(`File: ${filePath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
