import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProducts() {
    console.log('Generating sample products...');

    // 1. Get Categories and Brands
    const categories = await prisma.category.findMany();
    const brands = await prisma.brand.findMany();
    const currency = await prisma.currency.findFirst({ where: { code: 'SAR' } });

    if (categories.length === 0 || brands.length === 0 || !currency) {
        console.log('Missing basic data (categories/brands/currency). Ran "npm run seed" first?');
        return;
    }

    const sampleProducts = [
        { name: 'Hydraulic Filter HF123', sku: 'HF-123', desc: 'High performance hydraulic filter', cat: 'Hydraulic Filter', cost: 150 },
        { name: 'Air Filter Element AF55', sku: 'AF-55', desc: 'Primary air filter element', cat: 'Air Filter', cost: 85 },
        { name: 'Oil Filter OF99', sku: 'OF-99', desc: 'Spin-on oil filter', cat: 'Oil Filter', cost: 45 },
        { name: 'Fuel Water Separator FS200', sku: 'FS-200', desc: '10 micron fuel separator', cat: 'Fuel Filter', cost: 120 },
        { name: 'Cabin Air Filter CF10', sku: 'CF-10', desc: 'Activated carbon cabin filter', cat: 'Cabin Air Filter', cost: 65 },
        { name: 'Heavy Duty Oil Filter', sku: 'HD-OF-500', desc: 'For heavy trucks', cat: 'Oil Filter', cost: 200 },
        { name: 'Industrial Air Cleaner', sku: 'IND-AC-900', desc: 'Large capacity air cleaner', cat: 'Air Filter', cost: 450 },
        { name: 'Transmission Filter Kit', sku: 'TF-KIT-22', desc: 'Complete kit with gaskets', cat: 'Hydraulic Filter', cost: 300 },
        { name: 'Fuel Filter Insert', sku: 'FF-IN-88', desc: 'Eco-friendly element', cat: 'Fuel Filter', cost: 55 },
        { name: 'Breather Filter', sku: 'BF-12', desc: 'Tank breather filter', cat: 'Air Filter', cost: 35 }
    ];

    for (const p of sampleProducts) {
        // Find matching category
        const category = categories.find(c => c.name === p.cat) || categories[0];
        const brand = brands[Math.floor(Math.random() * brands.length)];

        // Check if exists
        const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
        if (!existing) {
            const product = await prisma.product.create({
                data: {
                    name: p.name,
                    sku: p.sku,
                    description: p.desc,
                    categoryId: category.id,
                    brandId: brand.id,
                    isActive: true,
                    images: [`https://placehold.co/400?text=${p.sku}`], // Dummy image
                    isFeatured: Math.random() > 0.7,
                    specifications: Prisma.JsonNull
                }
            });

            // Create Price
            await prisma.price.create({
                data: {
                    productId: product.id,
                    currencyId: currency.id,
                    priceRetail: p.cost,
                    priceWholesale: p.cost * 0.8,
                    isActive: true
                }
            });

            // Create Stock
            await prisma.stock.create({
                data: {
                    productId: product.id,
                    locationId: 'MAIN-WAREHOUSE',
                    qty: Math.floor(Math.random() * 100) + 10
                }
            });
            console.log(`Created product: ${p.sku}`);
        }
    }
    console.log('Sample products seeded.');
}

seedProducts()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
