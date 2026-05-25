import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log('Users in DB:', users.map(u => ({ id: u.id, email: u.email })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
