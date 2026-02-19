-- Add checkout_verification_code field to gate_passes table
-- This field stores a unique 6-digit verification code for checkout
-- Different from the original verification_code used for check-in

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'gate_passes' 
        AND column_name = 'checkout_verification_code'
    ) THEN
        ALTER TABLE gate_passes 
        ADD COLUMN checkout_verification_code TEXT;
        
        RAISE NOTICE 'Column checkout_verification_code added successfully';
    ELSE
        RAISE NOTICE 'Column checkout_verification_code already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'gate_passes'
AND column_name IN ('checkout_unique_id', 'checkout_verification_code')
ORDER BY column_name;
