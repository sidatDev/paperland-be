import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSampleOrders() {
    console.log('Adding sample orders for reports visualization...');

    // Get existing users
    const users = await prisma.user.findMany({ take: 3 });
    
    if (users.length === 0) {
        console.log('No users found. Please create users first.');
        return;
    }

    const currency = await prisma.currency.findFirst({ where: { code: 'SAR' } }) || await prisma.currency.findFirst();
    
    if (!currency) {
        console.log('No currency found. Please seed currencies first.');
        return;
    }

    const countries = ['Saudi Arabia', 'UAE', 'Pakistan', 'Egypt', 'Jordan'];
    const statuses = ['DELIVERED', 'COMPLETED'];
    
    // Create 20 sample completed orders with different dates and countries
    for (let i = 0; i < 20; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomCountryName = countries[Math.floor(Math.random() * countries.length)];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        // Random date within last 3 months
        const daysAgo = Math.floor(Math.random() * 90);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        
        const totalAmount = Math.floor(Math.random() * 5000) + 500; // 500 to 5500 SAR

        try {
            // Get or create an address for the user
            let address = await prisma.address.findFirst({ where: { userId: randomUser.id } });
            
            if (!address) {
                const country = await prisma.country.findFirst({ where: { name: randomCountryName } }) 
                             || await prisma.country.findFirst()
                             || await prisma.country.create({ 
                                    data: { 
                                        code: randomCountryName.substring(0, 2).toUpperCase(), 
                                        name: randomCountryName, 
                                        currencyId: currency.id 
                                    } 
                                });
                
                address = await prisma.address.create({
                    data: {
                        userId: randomUser.id,
                        firstName: randomUser.firstName || 'Test',
                        lastName: randomUser.lastName || 'User',
                        city: 'Test City',
                        street1: '123 Test Street',
                        zipCode: '12345',
                        phone: '123456789',
                        countryId: country.id
                    }
                });
            }

            await prisma.order.create({
                data: {
                    orderNumber: `ORD-SEED-${Date.now()}-${i}`,
                    userId: randomUser.id,
                    status: (randomStatus === 'COMPLETED' ? 'DELIVERED' : randomStatus) as any,
                    totalAmount: totalAmount,
                    taxAmount: totalAmount * 0.15,
                    shippingAmount: 50,
                    currencyId: currency.id,
                    addressId: address.id,
                    paymentMethod: 'CREDIT_CARD',
                    paymentStatus: 'PAID',
                    createdAt,
                    updatedAt: createdAt
                }
            });
            console.log(`✓ Created order ${i + 1}: ${randomStatus} - ${randomCountryName} - ${currency.code} ${totalAmount}`);
        } catch (error: any) {
            console.log(`✗ Failed to create order ${i + 1}: ${error.message}`);
        }
    }

    console.log('\nSample orders seeding completed!');
}

seedSampleOrders()
    .catch((error) => {
        console.error('Error seeding orders:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
