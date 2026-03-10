"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const ids = [
        'a75190c9-6aa8-48b1-af4f-aaeae6437b67',
        '0f92a6e6-b9c2-4ba1-986c-44d58ffdf449'
    ];
    for (const id of ids) {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { category: true, brand: true }
        });
        if (product) {
            console.log(`Product [${id}]: ${product.name}`);
            console.log(` - Category: ${product.category?.name || 'NULL'} (ID: ${product.categoryId})`);
            console.log(` - Brand: ${product.brand?.name || 'NULL'} (ID: ${product.brandId})`);
        }
        else {
            console.log(`Product [${id}] NOT FOUND.`);
        }
    }
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
