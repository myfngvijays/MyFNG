-- =====================================================
-- TELECALLER FORM - Missing Columns Fix
-- Purpose: Add payment_mode column for Telecaller form
-- =====================================================

-- Add payment_mode column (CRITICAL - MISSING)
ALTER TABLE public.service_leads
ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) 
CHECK (payment_mode IN ('PREPAID', 'COD', 'WALLET', 'UPI', 'CARD'));

COMMENT ON COLUMN public.service_leads.payment_mode IS 
'Payment method: PREPAID (online), COD (cash), WALLET, UPI, CARD';

-- Note: service_addons should use subservice_ids column (already exists)
-- The form is using service_addons but database has subservice_ids

-- Verify all columns exist
DO $$ 
BEGIN
  RAISE NOTICE 'Checking Telecaller required columns...';
  
  -- Check city_id
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='city_id') THEN
    RAISE NOTICE '✓ city_id exists';
  ELSE
    RAISE WARNING '✗ city_id MISSING!';
  END IF;
  
  -- Check model_id
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='model_id') THEN
    RAISE NOTICE '✓ model_id exists';
  ELSE
    RAISE WARNING '✗ model_id MISSING!';
  END IF;
  
  -- Check service_type_ids
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='service_type_ids') THEN
    RAISE NOTICE '✓ service_type_ids exists';
  ELSE
    RAISE WARNING '✗ service_type_ids MISSING!';
  END IF;
  
  -- Check subservice_ids (for add-ons)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='subservice_ids') THEN
    RAISE NOTICE '✓ subservice_ids exists (use for service_addons)';
  ELSE
    RAISE WARNING '✗ subservice_ids MISSING!';
  END IF;
  
  -- Check payment_mode
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='payment_mode') THEN
    RAISE NOTICE '✓ payment_mode exists';
  ELSE
    RAISE WARNING '✗ payment_mode MISSING!';
  END IF;
  
  -- Check coupon_code
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='coupon_code') THEN
    RAISE NOTICE '✓ coupon_code exists';
  ELSE
    RAISE WARNING '✗ coupon_code MISSING!';
  END IF;
  
  -- Check preferred_slot_end
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='preferred_slot_end') THEN
    RAISE NOTICE '✓ preferred_slot_end exists';
  ELSE
    RAISE WARNING '✗ preferred_slot_end MISSING!';
  END IF;
  
  -- Check customer_lat & customer_lng
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='customer_lat') THEN
    RAISE NOTICE '✓ customer_lat exists';
  ELSE
    RAISE WARNING '✗ customer_lat MISSING!';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='service_leads' AND column_name='customer_lng') THEN
    RAISE NOTICE '✓ customer_lng exists';
  ELSE
    RAISE WARNING '✗ customer_lng MISSING!';
  END IF;
  
  RAISE NOTICE 'Column check complete!';
END $$;

