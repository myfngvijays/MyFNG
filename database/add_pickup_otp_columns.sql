-- Add OTP related columns to service_leads table
-- Run this SQL in Supabase SQL Editor

-- Add pickup_otp column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'pickup_otp'
  ) THEN
    ALTER TABLE service_leads 
    ADD COLUMN pickup_otp VARCHAR(6);
    
    RAISE NOTICE 'Column pickup_otp added successfully';
  ELSE
    RAISE NOTICE 'Column pickup_otp already exists';
  END IF;
END $$;

-- Add pickup_otp_verified_at column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_leads' 
    AND column_name = 'pickup_otp_verified_at'
  ) THEN
    ALTER TABLE service_leads 
    ADD COLUMN pickup_otp_verified_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE 'Column pickup_otp_verified_at added successfully';
  ELSE
    RAISE NOTICE 'Column pickup_otp_verified_at already exists';
  END IF;
END $$;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
  AND column_name IN ('pickup_otp', 'pickup_otp_verified_at')
ORDER BY column_name;

