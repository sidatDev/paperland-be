-- Delete all products and related data
-- Run this script to clear all product data from the database

-- First, delete related data (foreign key constraints)
DELETE FROM "cart_items";
DELETE FROM "order_items";
DELETE FROM "rfq_items";
DELETE FROM "reviews";
DELETE FROM "batches";
DELETE FROM "product_industries";
DELETE FROM "stocks";
DELETE FROM "prices";

-- Finally, delete all products
DELETE FROM "products";

-- Verify deletion
SELECT COUNT(*) as remaining_products FROM "products";
