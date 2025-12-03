-- =====================================================
-- CHECK AVAILABLE CHECKLIST PACKAGES
-- Purpose: Show which service types/packages have checklists defined
-- Date: 2025-12-02
-- =====================================================

-- Query to check which service types have checklists in the generate_service_checklist function
-- This shows what service types are supported for checklist generation

SELECT 
  'Available Checklist Packages' as info,
  'Service Type Name' as package_name,
  'Checklist Items Count' as items_count,
  'Status' as status;

-- Check what service types are currently in the database
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
    ELSE '⚠️ No Specific Checklist (Will use default)'
  END as checklist_status,
  COUNT(DISTINCT sc.id) as existing_checklists_count
FROM public.service_types st
LEFT JOIN public.service_checklists sc ON sc.service_type = st.name
WHERE st.is_active = true
GROUP BY st.id, st.name, st.description, st.is_active
ORDER BY 
  CASE 
    WHEN UPPER(st.name) LIKE '%BASIC SERVICE%15 POINTS%' THEN 1
    WHEN UPPER(st.name) LIKE '%PREMIUM SERVICE%50 POINTS%' THEN 2
    WHEN UPPER(st.name) LIKE '%GENERAL SERVICE%30 POINTS%' THEN 3
    ELSE 4
  END,
  st.name;

-- Show checklist items count for existing checklists
SELECT 
  'Existing Checklists Summary' as info,
  COUNT(*) as total_checklists,
  COUNT(DISTINCT service_type) as unique_service_types,
  COUNT(DISTINCT lead_id) as leads_with_checklists,
  COUNT(DISTINCT mechanic_id) as mechanics_with_checklists
FROM public.service_checklists;

-- Show breakdown by service type
SELECT 
  sc.service_type,
  COUNT(*) as checklist_count,
  AVG(jsonb_array_length(sc.checklist_items)) as avg_items_per_checklist,
  MIN(jsonb_array_length(sc.checklist_items)) as min_items,
  MAX(jsonb_array_length(sc.checklist_items)) as max_items
FROM public.service_checklists sc
WHERE sc.checklist_items IS NOT NULL
GROUP BY sc.service_type
ORDER BY checklist_count DESC;

-- Show which service types are in generate_service_checklist function
-- (Based on the CASE statement in the function)
SELECT 
  'Supported Service Types in generate_service_checklist()' as info,
  'Basic Service (15 Points)' as service_type,
  '15 items' as items_count,
  '✅ Supported' as status
UNION ALL
SELECT 
  '',
  'Premium Service (50 Points)',
  '50 items',
  '✅ Supported'
UNION ALL
SELECT 
  '',
  'General Service (30 Points)',
  '30 items',
  '✅ Supported'
UNION ALL
SELECT 
  '',
  'FULL_SERVICE',
  '10 items (default)',
  '✅ Supported'
UNION ALL
SELECT 
  '',
  'AC_SERVICE',
  '5 items',
  '✅ Supported'
UNION ALL
SELECT 
  '',
  'BRAKE_SERVICE',
  '5 items',
  '✅ Supported'
UNION ALL
SELECT 
  '',
  'Any other service type',
  '3 items (default)',
  '⚠️ Uses default checklist';

-- Check for mechanic jobs without checklists
SELECT 
  'Mechanic Jobs Without Checklists' as info,
  COUNT(*) as jobs_without_checklists
FROM public.mechanic_jobs mj
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_checklists sc
  WHERE sc.lead_id = mj.lead_id
  AND sc.mechanic_id = mj.mechanic_id
);

-- Detailed list of jobs without checklists
SELECT 
  mj.id as job_id,
  mj.lead_id,
  sl.lead_number,
  mj.mechanic_id,
  ul.full_name as mechanic_name,
  sl.service_type,
  sl.service_type_ids,
  mj.mechanic_status,
  mj.assigned_at
FROM public.mechanic_jobs mj
JOIN public.service_leads sl ON mj.lead_id = sl.id
LEFT JOIN public.users_login ul ON mj.mechanic_id = ul.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_checklists sc
  WHERE sc.lead_id = mj.lead_id
  AND sc.mechanic_id = mj.mechanic_id
)
ORDER BY mj.assigned_at DESC
LIMIT 20;

DO $$
BEGIN
    RAISE NOTICE '✅ Checklist Package Information Retrieved!';
END $$;

