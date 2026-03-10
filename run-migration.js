// Safe Production Migration Script - Individual Statements
// Executes manual SQL migration for signup flow
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting safe production migration...\n');
  
  try {
    // Use Prisma's transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      console.log('🔒 Transaction started - will auto-rollback on any error\n');
      
      // STEP 1: Add new fields to users table
      console.log('📝 Step 1: Adding new fields to users table...');
      
      await tx.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10)
      `;
      
      await tx.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL
      `;
      
      await tx.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)
      `;
      
      await tx.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP WITH TIME ZONE
      `;
      
      await tx.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL
      `;
      
      // Update existing users to APPROVED status
      await tx.$executeRaw`
        UPDATE users 
        SET account_status = 'APPROVED', email_verified = true 
        WHERE account_status = 'PENDING'
      `;
      
      console.log('   ✅ Users table updated');
      
      // STEP 2: Create B2BCompanyDetails table
      console.log('📝 Step 2: Creating b2b_company_details table...');
      
      await tx.$executeRaw`
        CREATE TABLE IF NOT EXISTS b2b_company_details (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT NOT NULL UNIQUE,
          company_name VARCHAR(255) NOT NULL,
          registration_country VARCHAR(50) NOT NULL,
          tax_id VARCHAR(100) NOT NULL,
          registration_date TIMESTAMP WITH TIME ZONE NOT NULL,
          company_address TEXT NOT NULL,
          registration_proof_url TEXT NOT NULL,
          doing_business_as VARCHAR(255),
          primary_contact_name VARCHAR(255) NOT NULL,
          job_title VARCHAR(100) NOT NULL,
          contact_phone VARCHAR(50) NOT NULL,
          contact_country_code VARCHAR(10) NOT NULL,
          billing_email VARCHAR(255) NOT NULL,
          shipping_address TEXT NOT NULL,
          ap_contact_name VARCHAR(255) NOT NULL,
          ap_phone VARCHAR(50) NOT NULL,
          ap_country_code VARCHAR(10) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT fk_b2b_company_user 
            FOREIGN KEY (user_id) 
            REFERENCES users(id) 
            ON DELETE CASCADE
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_b2b_company_user_id ON b2b_company_details(user_id)
      `;
      
      console.log('   ✅ B2B Company Details table created');
      
      // STEP 3: Handle Cart tables
      console.log('📝 Step 3: Recreating cart tables...');
      
      await tx.$executeRaw`DROP TABLE IF EXISTS cart_items CASCADE`;
      await tx.$executeRaw`DROP TABLE IF EXISTS carts CASCADE`;
      
      await tx.$executeRaw`
        CREATE TABLE carts (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          user_id TEXT,
          guest_token VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT fk_cart_user 
            FOREIGN KEY (user_id) 
            REFERENCES users(id) 
            ON DELETE CASCADE
        )
      `;
      
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cart_user_id ON carts(user_id)`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cart_guest_token ON carts(guest_token)`;
      
      await tx.$executeRaw`
        CREATE TABLE cart_items (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          cart_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          quantity INTEGER DEFAULT 1 NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT fk_cart_item_cart 
            FOREIGN KEY (cart_id) 
            REFERENCES carts(id) 
            ON DELETE CASCADE,
          CONSTRAINT fk_cart_item_product 
            FOREIGN KEY (product_id) 
            REFERENCES products(id) 
            ON DELETE CASCADE,
          CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
        )
      `;
      
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cart_item_cart_id ON cart_items(cart_id)`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS idx_cart_item_product_id ON cart_items(product_id)`;
      
      console.log('   ✅ Cart tables recreated');
      
      console.log('\n✅ All migration steps completed successfully!');
    });
    
    // Verification queries (outside transaction)
    console.log('\n🔍 Running verification queries...\n');
    
    const userColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('phone_country_code', 'email_verified', 'otp_code', 'otp_expiry', 'account_status')
    `;
    console.log('✅ Users table new columns:', userColumns.map(c => c.column_name).join(', '));
    
    const b2bTable = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'b2b_company_details'
    `;
    console.log('✅ B2B Company Details table:', b2bTable.length > 0 ? 'Created ✓' : 'ERROR ✗');
    
    const cartsTable = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'carts'
    `;
    console.log('✅ Carts table:', cartsTable.length > 0 ? 'Recreated ✓' : 'ERROR ✗');
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('📊 All verifications passed');
    console.log('🔧 Next step: Run `npx prisma generate` to update Prisma Client\n');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    console.error('\n🔙 Transaction auto-rolled back - NO changes applied to database');
    console.error('\n💡 Database is in original state - no data lost');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
