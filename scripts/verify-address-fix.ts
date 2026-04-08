import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const country = await prisma.country.findFirst();
    if (!country) throw new Error("No country found");

    const addr = await prisma.address.create({
      data: {
        type: 'SHIPPING',
        firstName: 'Test',
        lastName: 'Guest',
        street1: '123 Test St',
        city: 'Test City',
        zipCode: '12345',
        phone: '3001234567',
        countryId: country.id,
        isDefault: false
        // userId is omitted
      }
    });
    console.log("Success: Created guest address", addr.id);
    // Cleanup
    await prisma.address.delete({ where: { id: addr.id } });
  } catch (err: any) {
    console.error("FAILED to create guest address:", err.message);
    process.exit(1);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
