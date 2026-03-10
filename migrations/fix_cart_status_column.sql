-- Fix Cart table schema mismatch
-- Add missing 'status' column

ALTER TABLE carts 
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- Verify column added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'carts'
ORDER BY ordinal_position;
