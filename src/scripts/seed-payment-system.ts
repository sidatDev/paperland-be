import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Payment System Seed Started ---');

  // 1. Create COD PaymentGateway record
  let codGateway = await (prisma as any).paymentGateway.findUnique({
    where: { identifier: 'cod' }
  });

  if (!codGateway) {
    codGateway = await (prisma as any).paymentGateway.create({
      data: {
        name: "Cash on Delivery",
        identifier: "cod",
        type: "COD",
        isActive: true,
        instructions: "Pay with cash when your order is delivered.",
        sortOrder: 0
      }
    });
    console.log('✅ Created COD Gateway record');
  } else {
    console.log('ℹ️ COD Gateway already exists');
  }

  // 2. Create Bank Transfer PaymentGateway record
  let bankGateway = await (prisma as any).paymentGateway.findUnique({
    where: { identifier: 'bank_transfer' }
  });

  if (!bankGateway) {
    bankGateway = await (prisma as any).paymentGateway.create({
      data: {
        name: "Bank Transfer",
        identifier: "bank_transfer",
        type: "BANK_TRANSFER",
        isActive: true,
        instructions: "Please transfer the total amount to one of our bank accounts listed below and upload the receipt.",
        sortOrder: 1
      }
    });
    console.log('✅ Created Bank Transfer Gateway record');
  } else {
    console.log('ℹ️ Bank Transfer Gateway already exists');
  }

  // 3. Migrate bank details from GlobalSettings → BankAccount
  const settings = await (prisma as any).globalSettings.findFirst();
  if (settings && settings.bankName && settings.bankAccountNumber) {
    const existingBank = await (prisma as any).bankAccount.findFirst({
      where: { accountNumber: settings.bankAccountNumber }
    });

    if (!existingBank) {
      await (prisma as any).bankAccount.create({
        data: {
          bankName: settings.bankName,
          accountTitle: settings.bankAccountName || 'PaperLand',
          accountNumber: settings.bankAccountNumber,
          iban: settings.bankIban || '',
          branch: settings.bankSwiftCode || '', // Reusing swift field for branch if needed
          isActive: true,
          sortOrder: 0
        }
      });
      console.log('✅ Migrated bank details from GlobalSettings to BankAccount table');
    } else {
      console.log('ℹ️ Bank account already migrated');
    }
  }

  // 4. Create default global rules (zoneId = null)
  // Global COD rule
  const codRule = await (prisma as any).paymentRule.findFirst({
    where: { zoneId: null, paymentType: 'COD' }
  });
  if (!codRule) {
    await (prisma as any).paymentRule.create({
      data: {
        zoneId: null,
        paymentType: 'COD',
        gatewayId: codGateway.id,
        isEnabled: true,
        maxOrderValue: 50000,
        priority: 0
      }
    });
    console.log('✅ Created global COD rule (Max 50k)');
  }

  // Global Bank Transfer rule
  const bankRule = await (prisma as any).paymentRule.findFirst({
    where: { zoneId: null, paymentType: 'BANK_TRANSFER' }
  });
  if (!bankRule) {
    await (prisma as any).paymentRule.create({
      data: {
        zoneId: null,
        paymentType: 'BANK_TRANSFER',
        gatewayId: bankGateway.id,
        isEnabled: true,
        priority: 1
      }
    });
    console.log('✅ Created global Bank Transfer rule');
  }

  // Global Stripe rule (if Stripe exists)
  const stripeGateway = await (prisma as any).paymentGateway.findFirst({
    where: { identifier: 'stripe' }
  });
  if (stripeGateway) {
    const stripeRule = await (prisma as any).paymentRule.findFirst({
      where: { zoneId: null, paymentType: 'ONLINE', gatewayId: stripeGateway.id }
    });
    if (!stripeRule) {
      await (prisma as any).paymentRule.create({
        data: {
          zoneId: null,
          paymentType: 'ONLINE',
          gatewayId: stripeGateway.id,
          isEnabled: true,
          priority: 2
        }
      });
      console.log('✅ Created global Stripe rule');
    }
  }

  console.log('--- Payment System Seed Completed ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
