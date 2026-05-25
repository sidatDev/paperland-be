import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const program = await (prisma as any).referralProgram.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!program) {
    console.error('No active referral program found!');
    return;
  }

  const referrerId = '0a57b9d7-7e0e-4fb2-9ce9-a647c3e84f9c'; // User majow74112@fengnu.com
  
  const testReferrals = [
    {
      programId: program.id,
      referrerId,
      referralCode: `REF-0a57b9d7-john.doe@example.com`,
      status: 'PENDING',
      rewardPaid: false,
    },
    {
      programId: program.id,
      referrerId,
      referralCode: `REF-0a57b9d7-sarah.smith@example.com`,
      status: 'ELIGIBLE',
      rewardPaid: false,
    },
    {
      programId: program.id,
      referrerId,
      referralCode: `REF-0a57b9d7-mike.jones@example.com`,
      status: 'REWARDED',
      rewardPaid: true,
    }
  ];

  for (const ref of testReferrals) {
    const existing = await (prisma as any).customerReferral.findFirst({
      where: { referralCode: ref.referralCode }
    });
    if (!existing) {
      await (prisma as any).customerReferral.create({ data: ref });
      console.log(`Created referral: ${ref.referralCode}`);
    } else {
      console.log(`Referral already exists: ${ref.referralCode}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
