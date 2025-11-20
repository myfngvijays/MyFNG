-- ============================================
-- CHECK ENUM VALUES FOR lead_type
-- ============================================
-- Run this to see what values are allowed

SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM 
    pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE 
    t.typname = 'lead_type'
ORDER BY 
    e.enumsortorder;

-- If no results, then lead_type enum doesn't exist yet!
-- We need to create it with proper values

