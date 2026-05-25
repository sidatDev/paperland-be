import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const referrals = await (prisma as any).customerReferral.findMany();
  console.log('Customer referrals in DB:', referrals);
  const programs = await (prisma as any).referralProgram.findMany();
  console.log('Referral programs in DB:', programs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
