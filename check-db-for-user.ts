
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userId = '29e255a3-ee99-4e1e-ba0b-3db4d2cc9187';
    console.log('Checking user:', userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: {
          include: { country: true }
        },
        b2bCompanyDetails: true
      }
    });

    if (!user) {
      console.log('User not found');
    } else {
        console.log('User Addresses:', JSON.stringify(user.addresses, null, 2));
        
        const defAddr = user.addresses ? user.addresses.find(a => a.isDefault && !a.deletedAt) : null;
        console.log('Default Address:', JSON.stringify(defAddr, null, 2));

        console.log('Computed City:', defAddr?.city || user.b2bCompanyDetails?.companyAddress || null);
        console.log('Computed Country:', defAddr?.country?.name || user.b2bCompanyDetails?.registrationCountry || null);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
