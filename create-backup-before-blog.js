const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function createBackup() {
  try {
    console.log('🔄 Starting database backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-before-blog-migration-${timestamp}.json`;
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filePath = path.join(backupDir, filename);
    
    // Fetch all important data
    const backup = {
      users: await prisma.user.findMany(),
      roles: await prisma.role.findMany(),
      permissions: await prisma.permission.findMany(),
      categories: await prisma.category.findMany(),
      brands: await prisma.brand.findMany(),
      products: await prisma.product.findMany(),
      orders: await prisma.order.findMany(),
      cmsPages: await prisma.cMSPage.findMany(),
      globalSettings: await prisma.globalSettings.findMany(),
      timestamp: new Date().toISOString(),
      version: 'pre-blog-migration'
    };
    
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✅ Backup created successfully!`);
    console.log(`📁 File: ${filename}`);
    console.log(`📊 Size: ${sizeMB} MB`);
    console.log(`📍 Location: ${filePath}`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createBackup();
