-- Migration: Add Guest Checkout Support
-- Created: April 7, 2026
-- Description: Adds support for guest checkout by making userId optional and adding guest-related fields

-- Add guest-related columns to orders table
ALTER TABLE "orders" 
ADD COLUMN IF NOT EXISTS "guest_email" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "guest_phone" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "is_guest_order" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "guest_token" VARCHAR(255);

-- Create index on guest_token for faster lookups
CREATE INDEX IF NOT EXISTS "idx_orders_guest_token" ON "orders"("guest_token");

-- Make user_id nullable in orders table
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- Make user_id nullable in addresses table (for guest addresses)
ALTER TABLE "addresses" ALTER COLUMN "user_id" DROP NOT NULL;

-- Make user_id nullable in transactions table (for guest transactions)
ALTER TABLE "transactions" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add index on is_guest_order for filtering
CREATE INDEX IF NOT EXISTS "idx_orders_is_guest" ON "orders"("is_guest_order");

-- Note: The customerType in Coupon model is a string field, not an enum
-- GUEST support will be handled at application level by adding "GUEST" option
