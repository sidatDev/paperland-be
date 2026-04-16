import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const gateways = [
    {
      name: 'JazzCash',
      identifier: 'jazzcash',
      type: 'WALLET',
      isActive: true,
      instructions: 'Please pay to JazzCash Wallet: 03123456789 and share screenshot.',
      sortOrder: 1,
    },
    {
      name: 'EasyPaisa',
      identifier: 'easypaisa',
      type: 'WALLET',
      isActive: true,
      instructions: 'Please pay to EasyPaisa Wallet: 03123456789 and share screenshot.',
      sortOrder: 2,
    },
    {
      name: 'Bank Transfer',
      identifier: 'bank_transfer',
      type: 'BANK_TRANSFER',
      isActive: true,
      instructions: 'Please transfer to: \nBank: Meezan Bank\nAccount: PaperLand\nIBAN: PK00MEZN0000123456789012',
      sortOrder: 3,
    },
    {
        name: 'Cash on Delivery',
        identifier: 'cod',
        type: 'CASH',
        isActive: true,
        instructions: 'Pay in cash upon delivery.',
        sortOrder: 4,
    },
    {
        name: 'Stripe',
        identifier: 'stripe',
        type: 'CARD',
        isActive: false,
        instructions: 'Pay securely with your credit or debit card via Stripe.',
        sortOrder: 5,
        config: {
            publishableKey: '',
            secretKey: '',
            webhookSecret: '',
            mode: 'test',
            currency: 'usd',
            exchangeRatePKR: 278
        }
    },
    {
        name: 'GoPayFast',
        identifier: 'gopayfast',
        type: 'CARD',
        isActive: false,
        instructions: 'You will be securely redirected to GoPayFast to complete your payment.',
        sortOrder: 6,
        config: {
            merchantId: '',
            secureKey: '',          // Never returned to frontend — masked in admin
            mode: 'sandbox',        // sandbox | live
            returnUrl: '',          // e.g. https://paperland.com.pk/en/payment/response
        }
    }
  ];

  for (const gateway of gateways) {
    await (prisma as any).paymentGateway.upsert({
      where: { identifier: gateway.identifier },
      update: gateway,
      create: gateway,
    });
  }

  console.log('Payment gateways seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
