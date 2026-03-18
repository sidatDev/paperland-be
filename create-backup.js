const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// All model names from schema.prisma mapped to Prisma Client accessor names
const MODELS = [
  { name: 'Currency', accessor: 'currency' },
  { name: 'Country', accessor: 'country' },
  { name: 'ExchangeRate', accessor: 'exchangeRate' },
  { name: 'Role', accessor: 'role' },
  { name: 'Permission', accessor: 'permission' },
  { name: 'RolePermission', accessor: 'rolePermission' },
  { name: 'UserPermission', accessor: 'userPermission' },
  { name: 'User', accessor: 'user' },
  { name: 'Address', accessor: 'address' },
  { name: 'B2BCompanyDetails', accessor: 'b2BCompanyDetails' },
  { name: 'B2BProfile', accessor: 'b2BProfile' },
  { name: 'Category', accessor: 'category' },
  { name: 'Brand', accessor: 'brand' },
  { name: 'Industry', accessor: 'industry' },
  { name: 'Product', accessor: 'product' },
  { name: 'ProductIndustry', accessor: 'productIndustry' },
  { name: 'Price', accessor: 'price' },
  { name: 'Batch', accessor: 'batch' },
  { name: 'Warehouse', accessor: 'warehouse' },
  { name: 'Stock', accessor: 'stock' },
  { name: 'Review', accessor: 'review' },
  { name: 'ProductImportLog', accessor: 'productImportLog' },
  { name: 'Order', accessor: 'order' },
  { name: 'OrderItem', accessor: 'orderItem' },
  { name: 'RFQ', accessor: 'rFQ' },
  { name: 'RFQItem', accessor: 'rFQItem' },
  { name: 'SupportTicket', accessor: 'supportTicket' },
  { name: 'TicketMessage', accessor: 'ticketMessage' },
  { name: 'ShippingZone', accessor: 'shippingZone' },
  { name: 'ShippingRate', accessor: 'shippingRate' },
  { name: 'Media', accessor: 'media' },
  { name: 'CMSPage', accessor: 'cMSPage' },
  { name: 'CMSVersion', accessor: 'cMSVersion' },
  { name: 'CMSLog', accessor: 'cMSLog' },
  { name: 'BlogCategory', accessor: 'blogCategory' },
  { name: 'BlogPost', accessor: 'blogPost' },
  { name: 'BlogSubscriber', accessor: 'blogSubscriber' },
  { name: 'PredefinedReport', accessor: 'predefinedReport' },
  { name: 'ReportLog', accessor: 'reportLog' },
  { name: 'Banner', accessor: 'banner' },
  { name: 'Transaction', accessor: 'transaction' },
  { name: 'OrderStatusHistory', accessor: 'orderStatusHistory' },
  { name: 'Cart', accessor: 'cart' },
  { name: 'CartItem', accessor: 'cartItem' },
  { name: 'Wishlist', accessor: 'wishlist' },
  { name: 'WishlistItem', accessor: 'wishlistItem' },
  { name: 'GlobalSettings', accessor: 'globalSettings' },
  { name: 'PaymentGateway', accessor: 'paymentGateway' },
  { name: 'ShippingCourier', accessor: 'shippingCourier' },
  { name: 'AuditLog', accessor: 'auditLog' },
  { name: 'HomepageSection', accessor: 'homepageSection' },
  { name: 'HomepageSectionItem', accessor: 'homepageSectionItem' },
  { name: 'CrossReference', accessor: 'crossReference' },
  { name: 'PendingRegistration', accessor: 'pendingRegistration' },
  { name: 'b2b_team_members', accessor: 'b2b_team_members' },
  { name: 'custom_catalog_items', accessor: 'custom_catalog_items' },
  { name: 'custom_catalogs', accessor: 'custom_catalogs' },
  { name: 'purchase_orders', accessor: 'purchase_orders' },
  { name: 'DiscountTier', accessor: 'discountTier' },
  { name: 'ProductDiscountOverride', accessor: 'productDiscountOverride' },
  { name: 'Coupon', accessor: 'coupon' },
  { name: 'ReturnRequest', accessor: 'returnRequest' },
  { name: 'ReturnItem', accessor: 'returnItem' },
  { name: 'FlashSale', accessor: 'flashSale' },
  { name: 'FlashSaleItem', accessor: 'flashSaleItem' },
  { name: 'ReferralProgram', accessor: 'referralProgram' },
  { name: 'CustomerReferral', accessor: 'customerReferral' },
  { name: 'DeliveryAgent', accessor: 'deliveryAgent' },
  { name: 'OrderCallLog', accessor: 'orderCallLog' },
  { name: 'SecurityDeposit', accessor: 'securityDeposit' },
];

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    
    // Ensure backups directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `full-backup-${timestamp}.json`);
    const backup = {};
    let totalRecords = 0;

    console.log('🔄 Starting FULL database backup...');
    console.log(`📅 Timestamp: ${new Date().toLocaleString()}`);
    console.log('─'.repeat(50));

    for (const model of MODELS) {
      try {
        const records = await prisma[model.accessor].findMany();
        backup[model.accessor] = records;
        totalRecords += records.length;
        if (records.length > 0) {
          console.log(`  ✅ ${model.name}: ${records.length} records`);
        } else {
          console.log(`  ⬜ ${model.name}: 0 records`);
        }
      } catch (err) {
        console.log(`  ⚠️  ${model.name}: SKIPPED (${err.message.substring(0, 60)})`);
        backup[model.accessor] = [];
      }
    }

    // Write backup file
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8');
    
    const fileSizeMB = (fs.statSync(backupFile).size / (1024 * 1024)).toFixed(2);

    console.log('─'.repeat(50));
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Total records: ${totalRecords}`);
    console.log(`💾 File size: ${fileSizeMB} MB`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createBackup();
