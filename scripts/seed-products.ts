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
        { name: 'Paper & Stationery', sku: 'NB-EXEC-P554005', desc: 'Premium bond paper', cat: 'Paper & Stationery', cost: 500 },
        { name: 'Executive Bond Paper Pack', sku: 'NB-EXEC-P554005-2', desc: 'High quality A4 paper', cat: 'Paper & Stationery', cost: 550 },
        { name: 'Premium Fountain Pen', sku: 'WR-PEN-001', desc: 'Elegant writing pen', cat: 'Writing Instruments', cost: 400 },
        { name: 'Luxury Leather Notebook', sku: 'NB-EXEC-002', desc: 'Premium bound notebook', cat: 'Notebooks & Journals', cost: 1000 },
        { name: 'A4 Sketchbook', sku: 'SB-A4-001', desc: 'Ideal for sketching', cat: 'Art & Craft', cost: 200 },
        { name: 'Desk Organizer Set', sku: 'DO-SET-01', desc: 'Complete organization kit', cat: 'Office Supplies', cost: 1800 },
        { name: 'Drafting Paper Roll', sku: 'DP-ROLL-01', desc: 'Technical drafting paper', cat: 'Art & Craft', cost: 1100 },
        { name: 'Fine Tip Markers (Set of 12)', sku: 'WR-MAR-12', desc: 'Vibrant colors set', cat: 'Writing Instruments', cost: 300 },
        { name: 'Mechanical Pencil 0.5mm', sku: 'WR-PEN-0.5', desc: 'Precision writing instrument', cat: 'Writing Instruments', cost: 150 },
        { name: 'Sticky Notes Pack', sku: 'OS-STK-01', desc: 'Colorful reminder notes', cat: 'Office Supplies', cost: 80 }
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
