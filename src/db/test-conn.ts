import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    const roles = await prisma.role.findMany();
    console.log('Successfully connected! Roles in DB:', roles);
  } catch (err) {
    console.error('Failed to connect:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
