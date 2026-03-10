"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- Verifying Category Soft Delete ---');
    // 1. Create a Test Category
    const testName = `Test-Delete-${Date.now()}`;
    console.log(`1. Creating category: ${testName}`);
    const created = await prisma.category.create({
        data: {
            name: testName,
            slug: testName.toLowerCase(),
            isActive: true,
        },
    });
    console.log(`   Created ID: ${created.id}, deletedAt: ${created.deletedAt}`);
    if (created.deletedAt !== null) {
        throw new Error('Newly created category should have deletedAt = null');
    }
    // 2. Simulate Soft Delete (Logic from API)
    console.log('2. Performing Soft Delete (updating deletedAt)...');
    const now = new Date();
    await prisma.category.update({
        where: { id: created.id },
        data: {
            deletedAt: now,
            isActive: false,
        },
    });
    // 3. Verify Persistence in DB
    console.log('3. Verifying category still exists in DB...');
    const check = await prisma.category.findUnique({
        where: { id: created.id },
    });
    if (!check) {
        console.error('FAILED: Category was Hard Deleted (removed from DB).');
    }
    else {
        console.log(`   Found Category in DB.`);
        console.log(`   Is Active: ${check.isActive} (Expected: false)`);
        console.log(`   Deleted At: ${check.deletedAt} (Expected: ${now.toISOString()})`);
        if (check.deletedAt && !check.isActive) {
            console.log('   SUCCESS: Category uses Soft Delete.');
        }
        else {
            console.error('   FAILED: Category properties incorrect for soft delete.');
        }
    }
    // 4. Verify Exclusion from "Active" List (Logic from GET API)
    console.log('4. Verifying exclusion from active list...');
    const list = await prisma.category.findMany({
        where: { deletedAt: null },
    });
    const foundInList = list.find(c => c.id === created.id);
    if (foundInList) {
        console.error('   FAILED: Soft deleted category appeared in non-deleted list.');
    }
    else {
        console.log('   SUCCESS: Soft deleted category is hidden from list.');
    }
    // Cleanup (Hard delete to keep DB clean)
    console.log('Cleaning up test data...');
    await prisma.category.delete({ where: { id: created.id } });
    console.log('Done.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
