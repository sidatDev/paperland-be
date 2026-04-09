import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Category Restructuring...');

    const parentCategories = [
        { name: 'SCHOOL ESSENTIALS', position: 1 },
        { name: 'OFFICE ITEMS', position: 2 },
        { name: 'ART SUPPLIES', position: 3 },
        { name: 'PAPER & SHEETS', position: 4 },
        { name: 'BOOKS', position: 5 },
        { name: 'GIFTS & CRAFT', position: 6 },
        { name: 'ACCESORIES', position: 7 },
    ];

    const parentsMap: Record<string, string> = {};

    // 1. Create or Update Parent Categories (Level 0)
    for (const parent of parentCategories) {
        const slug = parent.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-');
        const cat = await prisma.category.upsert({
            where: { slug },
            update: { position: parent.position, parentId: null },
            create: { name: parent.name, slug, position: parent.position, isActive: true }
        });
        parentsMap[parent.name] = cat.id;
        console.log(`✅ Parent category settled: ${parent.name}`);
    }

    // 2. Define Level 1 categories and move them to correct parents
    const level1Mapping = [
        // SCHOOL ESSENTIALS
        { name: 'PENS', parent: 'SCHOOL ESSENTIALS' },
        { name: 'Pencil Cases', parent: 'SCHOOL ESSENTIALS' },
        
        // OFFICE ITEMS
        { name: 'Writing Boards', parent: 'OFFICE ITEMS' },
        { name: 'Tapes & Dispenser', parent: 'OFFICE ITEMS' },
        { name: 'Holders & Organizers', parent: 'OFFICE ITEMS' },
        { name: 'Paper Organizers', parent: 'OFFICE ITEMS' },
        { name: 'Scissors & Cutters', parent: 'OFFICE ITEMS' },
        { name: 'Office Essential Machines', parent: 'OFFICE ITEMS' },

        // GIFTS & CRAFT
        { name: 'Decorative Items', parent: 'GIFTS & CRAFT' },
        { name: 'Party Supplies', parent: 'GIFTS & CRAFT' },
        { name: 'Slime & Clays', parent: 'GIFTS & CRAFT' },
        { name: 'Bags & Cloths', parent: 'GIFTS & CRAFT' },
        { name: 'Balloons', parent: 'GIFTS & CRAFT' },
        { name: 'Candles', parent: 'GIFTS & CRAFT' },
    ];

    const level1Map: Record<string, string> = {};

    for (const l1 of level1Mapping) {
        const slug = l1.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-');
        const cat = await prisma.category.upsert({
            where: { slug },
            update: { parentId: parentsMap[l1.parent] },
            create: { name: l1.name, slug, parentId: parentsMap[l1.parent], isActive: true }
        });
        level1Map[l1.name] = cat.id;
    }

    // 3. Re-parenting existing sub-categories (Level 2)
    // We try to match existing categories to these new parents
    const existingCats = await prisma.category.findMany({ where: { deletedAt: null } });

    for (const cat of existingCats) {
        // Skip parents we just created/updated
        if (parentCategories.some(p => p.name === cat.name)) continue;
        if (level1Mapping.some(l => l.name === cat.name)) continue;

        let newParentId = null;

        // Logic based on keywords or names
        const name = cat.name.toLowerCase();

        // SCHOOL ESSENTIALS -> PENS children
        if (name.includes('ballpoint') || name.includes('rollerball') || name.includes('gel pen') || name.includes('fountain pen') || name.includes('mechanical pencil') || name.includes('calligraphy')) {
            newParentId = level1Map['PENS'];
        } 
        // OFFICE ITEMS
        else if (name.includes('board') || name.includes('marker board')) {
            newParentId = level1Map['Writing Boards'];
        }
        else if (name.includes('tape') || name.includes('dispenser')) {
            newParentId = level1Map['Tapes & Dispenser'];
        }
        else if (name.includes('holder') || name.includes('organizer')) {
            newParentId = level1Map['Holders & Organizers'];
        }
        else if (name.includes('staple') || name.includes('punch') || name.includes('binder clip')) {
            newParentId = level1Map['Paper Organizers'];
        }
        else if (name.includes('cutter') || name.includes('scissor') || name.includes('knife')) {
            newParentId = level1Map['Scissors & Cutters'];
        }
        else if (name.includes('laminator') || name.includes('shredder') || name.includes('calculator')) {
            newParentId = level1Map['Office Essential Machines'];
        }
        // GIFTS & CRAFT
        else if (name.includes('sticker') || name.includes('pom pom') || name.includes('ribbon') || name.includes('glitter')) {
            newParentId = level1Map['Decorative Items'];
        }
        else if (name.includes('balloon') || name.includes('foil')) {
            newParentId = level1Map['Balloons'];
        }
        else if (name.includes('clay') || name.includes('pottery')) {
            newParentId = level1Map['Slime & Clays'];
        }
        // PAPER & SHEETS
        else if (name.includes('paper') || name.includes('notebook') || name.includes('scrapbook')) {
            newParentId = parentsMap['PAPER & SHEETS'];
        }
        // DEFAULT FALLBACKS
        else if (parentsMap[cat.name.toUpperCase()]) {
             // already handled or matches a parent
        }
        else {
             // If not matched, we can either leave it as is or move to a general parent
             // For now, let's keep them as is unless they were top level, in which case we move to OFFICE ITEMS
             if (!cat.parentId) {
                 newParentId = parentsMap['OFFICE ITEMS'];
             }
        }

        if (newParentId && newParentId !== cat.id) {
            await prisma.category.update({
                where: { id: cat.id },
                data: { parentId: newParentId }
            });
        }
    }

    console.log('✨ Categories Restructured Successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Restructure Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
