import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to manually create Grade tables...');

  try {
    // 1. Create grades table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "grades" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "description" TEXT,
          "is_active" BOOLEAN NOT NULL DEFAULT true,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Created "grades" table (if not exists).');

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "grades_name_key" ON "grades"("name");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "grades_slug_key" ON "grades"("slug");
    `);
    console.log('✅ Created indexes for "grades".');

    // 2. Create product_grades table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "product_grades" (
          "id" TEXT NOT NULL,
          "product_id" TEXT NOT NULL,
          "grade_id" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "product_grades_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Created "product_grades" table (if not exists).');

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "product_grades_product_id_grade_id_key" ON "product_grades"("product_id", "grade_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "product_grades_product_id_idx" ON "product_grades"("product_id");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "product_grades_grade_id_idx" ON "product_grades"("grade_id");
    `);
    console.log('✅ Created indexes for "product_grades".');

    // 3. Add Foreign Keys (wrapped in try/catch in case they already exist)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "product_grades" ADD CONSTRAINT "product_grades_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('✅ Added foreign key for grade_id.');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️ Foreign key for grade_id already exists.');
      } else {
        console.log('⚠️ Failed to add FK for grade_id:', e.message);
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "product_grades" ADD CONSTRAINT "product_grades_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('✅ Added foreign key for product_id.');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️ Foreign key for product_id already exists.');
      } else {
        console.log('⚠️ Failed to add FK for product_id:', e.message);
      }
    }

    console.log('🎉 Successfully applied Grade schema changes directly via SQL.');

  } catch (error) {
    console.error('❌ Failed to create tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
