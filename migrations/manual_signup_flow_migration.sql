-- ================================================
-- SAFE PRODUCTION MIGRATION: Signup Flow Fields
-- ================================================
-- This migration ONLY modifies:
-- 1. users table (adds new fields)
-- 2. b2b_company_details table (creates new)
-- 3. carts & cart_items tables (handles schema drift)
-- 
-- ALL OTHER TABLES REMAIN UNTOUCHED - NO DATA LOSS
-- ================================================

BEGIN;

-- ================================================
-- STEP 1: Add new fields to users table
-- ================================================
-- These are additive changes - NO DATA LOSS
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL;

-- Update existing users to APPROVED status (they're already active)
UPDATE users 
SET account_status = 'APPROVED', 
    email_verified = true 
WHERE account_status = 'PENDING';

-- ================================================
-- STEP 2: Create B2BCompanyDetails table
-- ================================================
CREATE TABLE IF NOT EXISTS b2b_company_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Company Information (Step 4)
  company_name VARCHAR(255) NOT NULL,
  registration_country VARCHAR(50) NOT NULL,
  tax_id VARCHAR(100) NOT NULL,
  registration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  company_address TEXT NOT NULL,
  registration_proof_url TEXT NOT NULL,
  doing_business_as VARCHAR(255),
  
  -- Contact Details (Step 5)
  primary_contact_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  contact_country_code VARCHAR(10) NOT NULL,
  billing_email VARCHAR(255) NOT NULL,
  shipping_address TEXT NOT NULL,
  
  -- Accounts Payable Contact
  ap_contact_name VARCHAR(255) NOT NULL,
  ap_phone VARCHAR(50) NOT NULL,
  ap_country_code VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT fk_b2b_company_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_b2b_company_user_id ON b2b_company_details(user_id);

-- ================================================
-- STEP 3: Handle Cart table schema drift
-- ================================================
-- User confirmed cart data can be reset for new implementation
-- This fixes the unique constraint issue Prisma detected

-- Drop cart_items first (foreign key dependency)
DROP TABLE IF EXISTS cart_items CASCADE;

-- Drop carts table
DROP TABLE IF EXISTS carts CASCADE;

-- Recreate carts table matching current Prisma schema
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  guest_token VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT fk_cart_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_guest_token ON carts(guest_token);

-- Recreate cart_items table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL,
  product_id UUID NOT NULL,
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
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cart_item_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_product_id ON cart_items(product_id);

-- ================================================
-- COMMIT TRANSACTION
-- ================================================
COMMIT;

-- ================================================
-- VERIFICATION QUERIES (Run these after migration)
-- ================================================
-- Verify users table has new columns:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('phone_country_code', 'email_verified', 'otp_code', 'otp_expiry', 'account_status');

-- Verify b2b_company_details table exists:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'b2b_company_details';

-- Verify carts table recreated:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'carts';

-- ================================================
-- ROLLBACK SCRIPT (if needed)
-- ================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS phone_country_code, DROP COLUMN IF EXISTS email_verified, DROP COLUMN IF EXISTS otp_code, DROP COLUMN IF EXISTS otp_expiry, DROP COLUMN IF EXISTS account_status;
-- DROP TABLE IF EXISTS b2b_company_details CASCADE;
