
import { PrismaClient } from '@prisma/client';
import { Client } from 'typesense';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const typesense = new Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 5,
});

async function debug() {
    try {
        const targetId = '403e90b6-c8f8-461d-b347-9c915541ee8a';
        const targetProduct = await prisma.product.findUnique({ where: { id: targetId } });
        
        if (targetProduct) {
             console.log(`\n[DB] Target Product: ${targetProduct.name}`);
             console.log(` - ID: ${targetProduct.id}`);
             console.log(` - isActive: ${targetProduct.isActive}`);
             console.log(` - deletedAt: ${targetProduct.deletedAt}`);
             console.log(` - specs:`, targetProduct.specifications);
        } else {
             console.log(`[DB] Target Product NOT FOUND`);
        }

        try {
            const doc: any = await typesense.collections('products').documents(targetId).retrieve();
            console.log(`\n[TS] Document:`);
            console.log(` - isActive: ${doc.isActive}`);
            console.log(` - status: ${doc.status}`);
        } catch (e: any) {
            console.log(`\n[TS] Document NOT FOUND`);
        }

        console.log("\n--- Audit Missing Products ---");
        const allDrafts = await prisma.product.findMany({ where: { isActive: false } });
        allDrafts.forEach(p => {
             console.log(`${p.name} (Del: ${p.deletedAt})`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
