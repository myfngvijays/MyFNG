-- ============================================
-- CHECK PAYMENT MODE IN LATEST LEAD
-- ============================================

-- Check if payment_mode column exists
SELECT 
    'payment_mode column exists' AS status,
    data_type,
    is_nullable
FROM 
    information_schema.columns 
WHERE 
    table_name = 'service_leads' 
    AND column_name = 'payment_mode';

-- Get latest lead with payment_mode
SELECT 
    lead_number,
    customer_name,
    payment_mode,          -- ← This should show the value
    service_type_ids,      -- ← Check if service types saved
    subservice_ids,        -- ← Check if addons saved
    pickup_required,
    notes,
    created_at
FROM 
    public.service_leads
ORDER BY 
    created_at DESC
LIMIT 5;

-- ============================================
-- If payment_mode is NULL or empty, then issue hai
-- If payment_mode has value, then working hai!
-- ============================================

