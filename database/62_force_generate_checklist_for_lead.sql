-- ============================================
-- Force Generate Checklist for Specific Lead
-- Lead ID: a019835d-4775-4b43-b484-5ef5ed5efd9f
-- ============================================

-- Step 1: Delete any existing empty checklist
DELETE FROM service_checklists 
WHERE lead_id = 'a019835d-4775-4b43-b484-5ef5ed5efd9f'
  AND (checklist_items IS NULL OR jsonb_array_length(checklist_items) = 0);

-- Step 2: Get lead details and service type
DO $$
DECLARE
  v_lead_id uuid := 'a019835d-4775-4b43-b484-5ef5ed5efd9f';
  v_mechanic_id uuid;
  v_service_type_ids jsonb;
  v_service_type_id uuid;
  v_service_type_name varchar;
  v_checklist_id uuid;
BEGIN
  -- Get mechanic_id from mechanic_jobs
  SELECT mechanic_id INTO v_mechanic_id
  FROM mechanic_jobs
  WHERE lead_id = v_lead_id
  LIMIT 1;
  
  RAISE NOTICE 'Mechanic ID: %', v_mechanic_id;
  
  IF v_mechanic_id IS NULL THEN
    RAISE NOTICE '❌ No mechanic assigned to this lead!';
    RETURN;
  END IF;
  
  -- Get service type IDs from service_leads
  SELECT service_type_ids INTO v_service_type_ids
  FROM service_leads
  WHERE id = v_lead_id;
  
  RAISE NOTICE 'Service Type IDs: %', v_service_type_ids;
  
  -- Get the first service type ID
  IF v_service_type_ids IS NOT NULL AND jsonb_array_length(v_service_type_ids) > 0 THEN
    v_service_type_id := (v_service_type_ids->>0)::uuid;
    
    -- Get service type name from service_types table
    SELECT name INTO v_service_type_name
    FROM service_types
    WHERE id = v_service_type_id;
    
    RAISE NOTICE 'Service Type ID: %', v_service_type_id;
    RAISE NOTICE 'Service Type Name: %', v_service_type_name;
    
    -- If service type name found, generate checklist
    IF v_service_type_name IS NOT NULL AND v_service_type_name != '' THEN
      -- Delete any existing checklist first
      DELETE FROM service_checklists 
      WHERE lead_id = v_lead_id 
        AND mechanic_id = v_mechanic_id;
      
      -- Generate checklist
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        v_service_type_name
      ) INTO v_checklist_id;
      
      RAISE NOTICE '✅ Checklist generated! ID: %', v_checklist_id;
      
      -- Verify checklist was created
      SELECT jsonb_array_length(checklist_items) INTO v_checklist_id
      FROM service_checklists
      WHERE id = v_checklist_id;
      
      RAISE NOTICE 'Checklist items count: %', v_checklist_id;
    ELSE
      RAISE NOTICE '❌ Service type name is NULL or empty!';
      RAISE NOTICE 'Trying with fallback: Basic Service';
      
      -- Try with 'Basic Service' as fallback
      DELETE FROM service_checklists 
      WHERE lead_id = v_lead_id 
        AND mechanic_id = v_mechanic_id;
      
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        'Basic Service'
      ) INTO v_checklist_id;
      
      RAISE NOTICE '✅ Checklist generated with fallback! ID: %', v_checklist_id;
    END IF;
  ELSE
    RAISE NOTICE '❌ No service_type_ids found!';
    
    -- Try to get legacy service_type column
    SELECT service_type INTO v_service_type_name
    FROM service_leads
    WHERE id = v_lead_id;
    
    RAISE NOTICE 'Legacy service_type: %', v_service_type_name;
    
    IF v_service_type_name IS NOT NULL AND v_service_type_name != '' THEN
      DELETE FROM service_checklists 
      WHERE lead_id = v_lead_id 
        AND mechanic_id = v_mechanic_id;
      
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        v_service_type_name
      ) INTO v_checklist_id;
      
      RAISE NOTICE '✅ Checklist generated with legacy service_type! ID: %', v_checklist_id;
    END IF;
  END IF;
END $$;

-- Step 3: Verify the checklist was created
SELECT 
  sc.id,
  sc.lead_id,
  sc.mechanic_id,
  sc.service_type,
  jsonb_array_length(sc.checklist_items) as items_count,
  sc.total_items,
  sc.completed_items,
  sc.completion_percentage
FROM service_checklists sc
WHERE sc.lead_id = 'a019835d-4775-4b43-b484-5ef5ed5efd9f';

-- Step 4: Show first few checklist items
SELECT 
  sc.id as checklist_id,
  jsonb_array_elements(sc.checklist_items) as item
FROM service_checklists sc
WHERE sc.lead_id = 'a019835d-4775-4b43-b484-5ef5ed5efd9f'
LIMIT 5;

