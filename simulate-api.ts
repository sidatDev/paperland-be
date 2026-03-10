
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userId = '29e255a3-ee99-4e1e-ba0b-3db4d2cc9187';
    
    // Simulate GET /profile logic
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        b2bCompanyDetails: true,
        addresses: {
          where: { isDefault: true, deletedAt: null },
          include: { country: true },
          take: 1
        }
      }
    });

    const updatedUser = user;
    const b2b = updatedUser?.b2bCompanyDetails;
    const defAddr = updatedUser?.addresses?.[0];

    const responseUser = {
        ...updatedUser,
        city: defAddr?.city || b2b?.companyAddress || null,
        country: defAddr?.country?.name || b2b?.registrationCountry || null,
        companyName: updatedUser?.companyName || b2b?.companyName || null
    };

    console.log('--- GET /profile Response ---');
    console.log(JSON.stringify(responseUser, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
