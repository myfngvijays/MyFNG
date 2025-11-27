-- ============================================
-- Verify Premium Service (50 Points) Checklist
-- ============================================

-- Step 1: Check if function exists
SELECT 
  'Function Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'generate_service_checklist'
    ) THEN '✅ Function exists'
    ELSE '❌ Function not found'
  END as status;

-- Step 2: Test generating Premium Service checklist
DO $$
DECLARE
  v_test_lead_id uuid := '00000000-0000-0000-0000-000000000001';
  v_test_mechanic_id uuid := '00000000-0000-0000-0000-000000000002';
  v_checklist_id uuid;
  v_checklist_items jsonb;
  v_total_items integer;
  v_engine_count integer;
  v_cabin_count integer;
  v_wheel_count integer;
  v_others_count integer;
BEGIN
  -- Clean up test data if exists
  DELETE FROM service_checklists WHERE lead_id = v_test_lead_id;
  
  -- Generate checklist
  SELECT generate_service_checklist(
    v_test_lead_id,
    v_test_mechanic_id,
    'Premium Service (50 Points)'
  ) INTO v_checklist_id;
  
  -- Get checklist items
  SELECT checklist_items, total_items
  INTO v_checklist_items, v_total_items
  FROM service_checklists
  WHERE id = v_checklist_id;
  
  -- Count items by category
  SELECT COUNT(*) INTO v_engine_count
  FROM jsonb_array_elements(v_checklist_items) AS item
  WHERE (item->>'category') = 'Engine Compartment';
  
  SELECT COUNT(*) INTO v_cabin_count
  FROM jsonb_array_elements(v_checklist_items) AS item
  WHERE (item->>'category') = 'Cabin';
  
  SELECT COUNT(*) INTO v_wheel_count
  FROM jsonb_array_elements(v_checklist_items) AS item
  WHERE (item->>'category') = 'Wheel & Brakes';
  
  SELECT COUNT(*) INTO v_others_count
  FROM jsonb_array_elements(v_checklist_items) AS item
  WHERE (item->>'category') = 'Others';
  
  -- Display results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Premium Service (50 Points) Checklist Verification';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Checklist ID: %', v_checklist_id;
  RAISE NOTICE 'Total Items: % (Expected: 50)', v_total_items;
  RAISE NOTICE 'Engine Compartment: % items (Expected: 17)', v_engine_count;
  RAISE NOTICE 'Cabin: % items (Expected: 13)', v_cabin_count;
  RAISE NOTICE 'Wheel & Brakes: % items (Expected: 17)', v_wheel_count;
  RAISE NOTICE 'Others: % items (Expected: 3)', v_others_count;
  RAISE NOTICE '========================================';
  
  -- Verify counts
  IF v_total_items = 50 THEN
    RAISE NOTICE '✅ Total items: CORRECT';
  ELSE
    RAISE NOTICE '❌ Total items: INCORRECT (Expected 50, Got %)', v_total_items;
  END IF;
  
  IF v_engine_count = 17 THEN
    RAISE NOTICE '✅ Engine Compartment: CORRECT';
  ELSE
    RAISE NOTICE '❌ Engine Compartment: INCORRECT (Expected 17, Got %)', v_engine_count;
  END IF;
  
  IF v_cabin_count = 13 THEN
    RAISE NOTICE '✅ Cabin: CORRECT';
  ELSE
    RAISE NOTICE '❌ Cabin: INCORRECT (Expected 13, Got %)', v_cabin_count;
  END IF;
  
  IF v_wheel_count = 17 THEN
    RAISE NOTICE '✅ Wheel & Brakes: CORRECT';
  ELSE
    RAISE NOTICE '❌ Wheel & Brakes: INCORRECT (Expected 17, Got %)', v_wheel_count;
  END IF;
  
  IF v_others_count = 3 THEN
    RAISE NOTICE '✅ Others: CORRECT';
  ELSE
    RAISE NOTICE '❌ Others: INCORRECT (Expected 3, Got %)', v_others_count;
  END IF;
  
  -- Clean up test data
  DELETE FROM service_checklists WHERE lead_id = v_test_lead_id;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Test completed. Test data cleaned up.';
  RAISE NOTICE '========================================';
END $$;

-- Step 3: Show sample checklist items by category
SELECT 
  'Sample Items by Category' as check_type,
  item->>'category' as category,
  item->>'id' as item_id,
  item->>'name' as item_name,
  item->>'status' as status,
  item->>'mandatory' as mandatory,
  CASE 
    WHEN item->>'remark' IS NOT NULL THEN 'Has remark field'
    ELSE 'No remark field'
  END as remark_status
FROM (
  SELECT generate_service_checklist(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid,
    'Premium Service (50 Points)'
  ) as checklist_id
) gen
CROSS JOIN LATERAL (
  SELECT checklist_items
  FROM service_checklists
  WHERE id = gen.checklist_id
) sc
CROSS JOIN LATERAL jsonb_array_elements(sc.checklist_items) AS item
ORDER BY 
  CASE item->>'category'
    WHEN 'Engine Compartment' THEN 1
    WHEN 'Cabin' THEN 2
    WHEN 'Wheel & Brakes' THEN 3
    WHEN 'Others' THEN 4
    ELSE 5
  END,
  (item->>'id')::integer
LIMIT 20;

-- Clean up sample data
DELETE FROM service_checklists 
WHERE lead_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003'
);

-- Step 4: Verify all required fields exist in checklist items
SELECT 
  'Field Verification' as check_type,
  COUNT(*) FILTER (WHERE item ? 'id') as has_id,
  COUNT(*) FILTER (WHERE item ? 'name') as has_name,
  COUNT(*) FILTER (WHERE item ? 'status') as has_status,
  COUNT(*) FILTER (WHERE item ? 'mandatory') as has_mandatory,
  COUNT(*) FILTER (WHERE item ? 'category') as has_category,
  COUNT(*) FILTER (WHERE item ? 'remark') as has_remark
FROM (
  SELECT generate_service_checklist(
    '00000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    'Premium Service (50 Points)'
  ) as checklist_id
) gen
CROSS JOIN LATERAL (
  SELECT checklist_items
  FROM service_checklists
  WHERE id = gen.checklist_id
) sc
CROSS JOIN LATERAL jsonb_array_elements(sc.checklist_items) AS item;

-- Clean up
DELETE FROM service_checklists 
WHERE lead_id = '00000000-0000-0000-0000-000000000005';

-- Step 5: Summary Report
SELECT 
  'Summary' as report_type,
  'Premium Service (50 Points)' as service_type,
  '50 items across 4 categories' as description,
  'Engine Compartment: 17 items' as category1,
  'Cabin: 13 items' as category2,
  'Wheel & Brakes: 17 items' as category3,
  'Others: 3 items' as category4,
  'All items have: id, name, status, mandatory, category, remark' as fields;

