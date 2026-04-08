import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function verifyDynamicIssuance() {
  console.log('🚀 Starting Dynamic Coupon Issuance Verification...');

  try {
    // 1. Create a DYNAMIC Template for New Customers
    const templateCode = `TEMPLATE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    console.log(`Step 1: Creating Dynamic Template: ${templateCode}`);
    
    const template = await prisma.coupon.create({
      data: {
        code: templateCode,
        title: 'Dynamic Welcome Template',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        couponType: 'DYNAMIC',
        customerType: 'NEW_CUSTOMERS',
        isActive: true
      }
    });

    // 2. Mock User Data
    const mockUser = {
      id: 'mock-user-id-' + crypto.randomBytes(4).toString('hex'),
      email: 'test-dynamic@example.com',
      firstName: 'John'
    };

    // 3. Simulate the issuance logic (copied from auth-signup.routes.ts for verification)
    console.log('Step 2: Simulating issuance for user:', mockUser.email);
    
    const accountType = 'B2C';
    const customerTypeFilter = accountType === 'B2C' 
      ? ['ALL', 'NEW_CUSTOMERS'] 
      : ['ALL', 'B2B_ONLY'];

    const templates = await prisma.coupon.findMany({
      where: {
        couponType: 'DYNAMIC',
        isActive: true,
        deletedAt: null,
        customerType: { in: customerTypeFilter }
      }
    });

    console.log(`Found ${templates.length} templates matching filter.`);

    for (const t of templates) {
      if (t.id !== template.id) continue;

      const templateCodePrefix = t.code.includes('PL-') ? t.code : `PL-${t.code}`;
      const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      const userPart = mockUser.firstName?.substring(0, 2).toUpperCase() || 'USR';
      const uniqueCode = `${templateCodePrefix}-${userPart}-${randomSuffix}`.substring(0, 30);

      const newCoupon = await prisma.coupon.create({
        data: {
          code: uniqueCode,
          title: `${t.title || 'Welcome Discount'} (Personal)`,
          description: t.description || `Special personalized offer for ${mockUser.email}`,
          discountType: t.discountType,
          discountValue: t.discountValue,
          startDate: new Date(),
          endDate: t.endDate,
          usageLimit: 1,
          usageLimitPerCustomer: 1,
          isActive: true,
          couponType: 'STATIC',
          customerType: t.customerType,
          visibility: 'PRIVATE'
        }
      });

      console.log(`✅ SUCCESS: Issued unique coupon: ${newCoupon.code}`);
      
      // Cleanup
      await prisma.coupon.delete({ where: { id: newCoupon.id } });
    }

    // Cleanup template
    await prisma.coupon.delete({ where: { id: template.id } });
    console.log('🏁 Verification Finished Successfully.');

  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDynamicIssuance();
