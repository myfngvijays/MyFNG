-- =====================================================
-- CHECK SERVICE TYPE NAMES FOR GIVEN UUIDs
-- Purpose: Verify which service types correspond to the UUIDs in the jobs
-- Date: 2025-12-02
-- =====================================================

-- Check service types for the UUIDs found in the jobs
SELECT 
  st.id,
  st.name as service_type_name,
  st.description,
  st.is_active,
  CASE 
    WHEN UPPER(st.name) LIKE '%BASIC SERVICE%15 POINTS%' OR 
         UPPER(st.name) = 'BASIC SERVICE (15 POINTS)' OR
         st.name = 'Basic Service (15 Points)' THEN '✅ Has Checklist (15 points)'
    WHEN UPPER(st.name) LIKE '%PREMIUM SERVICE%50 POINTS%' OR 
         UPPER(st.name) = 'PREMIUM SERVICE (50 POINTS)' OR
         st.name = 'Premium Service (50 Points)' THEN '✅ Has Checklist (50 points)'
    WHEN UPPER(st.name) LIKE '%GENERAL SERVICE%30 POINTS%' OR
         UPPER(st.name) LIKE '%30 POINT%' THEN '✅ Has Checklist (30 points)'
    WHEN UPPER(st.name) LIKE '%FULL_SERVICE%' OR 
         UPPER(st.name) LIKE '%FULL SERVICE%' THEN '✅ Has Checklist (Default)'
    WHEN UPPER(st.name) LIKE '%AC_SERVICE%' OR 
         UPPER(st.name) LIKE '%AC SERVICE%' THEN '✅ Has Checklist (AC Service)'
    WHEN UPPER(st.name) LIKE '%BRAKE_SERVICE%' OR 
         UPPER(st.name) LIKE '%BRAKE SERVICE%' THEN '✅ Has Checklist (Brake Service)'
    ELSE '⚠️ No Specific Checklist (Will use default 3 items)'
  END as checklist_status
FROM public.service_types st
WHERE st.id IN (
  '609d1e8d-3fe3-409a-a0b0-293f4a0ef0d2',  -- From job 1 and 4
  'd0000001-0001-0001-0001-000000000001',  -- From job 2
  'd0000001-0001-0001-0001-000000000004',  -- From jobs 3, 5
  'd0000001-0001-0001-0001-000000000002',  -- From jobs 6, 7
  'd0000001-0001-0001-0001-000000000005',  -- From jobs 6, 7
  'e447abcc-7dd3-4265-94b7-fb887ca1dce4'   -- From job 3
)
ORDER BY st.name;

-- Show all active service types for reference
SELECT 
  'All Active Service Types' as info,
  COUNT(*) as total_count
FROM public.service_types
WHERE is_active = true;

SELECT 
  st.id,
  st.name,
  st.description,
  CASE 
    WHEN UPPER(st.name) LIKE '%BASIC SERVICE%15 POINTS%' THEN '✅ 15 points'
    WHEN UPPER(st.name) LIKE '%PREMIUM SERVICE%50 POINTS%' THEN '✅ 50 points'
    WHEN UPPER(st.name) LIKE '%GENERAL SERVICE%30 POINTS%' THEN '✅ 30 points'
    WHEN UPPER(st.name) LIKE '%FULL_SERVICE%' OR UPPER(st.name) LIKE '%FULL SERVICE%' THEN '✅ 10 items'
    WHEN UPPER(st.name) LIKE '%AC_SERVICE%' OR UPPER(st.name) LIKE '%AC SERVICE%' THEN '✅ 5 items'
    WHEN UPPER(st.name) LIKE '%BRAKE_SERVICE%' OR UPPER(st.name) LIKE '%BRAKE SERVICE%' THEN '✅ 5 items'
    ELSE '⚠️ Default (3 items)'
  END as checklist_info
FROM public.service_types st
WHERE st.is_active = true
ORDER BY 
  CASE 
    WHEN UPPER(st.name) LIKE '%BASIC SERVICE%15 POINTS%' THEN 1
    WHEN UPPER(st.name) LIKE '%PREMIUM SERVICE%50 POINTS%' THEN 2
    WHEN UPPER(st.name) LIKE '%GENERAL SERVICE%30 POINTS%' THEN 3
    ELSE 4
  END,
  st.name;

DO $$
BEGIN
    RAISE NOTICE '✅ Service Type Names Check Complete!';
END $$;

