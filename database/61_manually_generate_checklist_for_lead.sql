-- ============================================
-- Manually Generate Checklist for Specific Lead
-- Purpose: Generate checklist for lead that doesn't have one
-- Lead ID: a019835d-4775-4b43-b484-5ef5ed5efd9f
-- Mechanic ID: 7fa49f5a-08e3-428e-8e6a-f4794e827302
-- ============================================

-- First, let's check what service type is assigned to this lead
DO $$
DECLARE
  v_lead_id uuid := 'a019835d-4775-4b43-b484-5ef5ed5efd9f';
  v_mechanic_id uuid := '7fa49f5a-08e3-428e-8e6a-f4794e827302';
  v_service_type_ids jsonb;
  v_service_type_id uuid;
  v_service_type_name varchar;
  v_checklist_id uuid;
  v_existing_checklist_id uuid;
BEGIN
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
    
    -- Check if checklist already exists
    SELECT id INTO v_existing_checklist_id
    FROM service_checklists
    WHERE lead_id = v_lead_id
      AND mechanic_id = v_mechanic_id;
    
    IF v_existing_checklist_id IS NOT NULL THEN
      RAISE NOTICE 'Checklist already exists with ID: %', v_existing_checklist_id;
      
      -- Delete existing checklist if it's empty or has no items
      DELETE FROM service_checklists
      WHERE id = v_existing_checklist_id
        AND (checklist_items IS NULL OR jsonb_array_length(checklist_items) = 0);
      
      IF FOUND THEN
        RAISE NOTICE 'Deleted empty checklist';
      END IF;
    END IF;
    
    -- Generate checklist with service type name
    IF v_service_type_name IS NOT NULL AND v_service_type_name != '' THEN
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        v_service_type_name
      ) INTO v_checklist_id;
      
      RAISE NOTICE 'Checklist generated successfully with ID: %', v_checklist_id;
      
      -- Verify the checklist was created
      SELECT id INTO v_checklist_id
      FROM service_checklists
      WHERE lead_id = v_lead_id
        AND mechanic_id = v_mechanic_id;
      
      IF v_checklist_id IS NOT NULL THEN
        RAISE NOTICE '✅ Checklist verified! ID: %', v_checklist_id;
        
        -- Show checklist items count
        SELECT jsonb_array_length(checklist_items) INTO v_checklist_id
        FROM service_checklists
        WHERE id = v_checklist_id;
        
        RAISE NOTICE 'Checklist items count: %', v_checklist_id;
      ELSE
        RAISE NOTICE '❌ Checklist was not created!';
      END IF;
    ELSE
      RAISE NOTICE '❌ Service type name is NULL or empty!';
      RAISE NOTICE 'Trying with fallback service type...';
      
      -- Try with 'Basic Service' as fallback
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        'Basic Service'
      ) INTO v_checklist_id;
      
      RAISE NOTICE 'Checklist generated with fallback name, ID: %', v_checklist_id;
    END IF;
  ELSE
    RAISE NOTICE '❌ No service_type_ids found for this lead!';
    
    -- Try to get legacy service_type column
    SELECT service_type INTO v_service_type_name
    FROM service_leads
    WHERE id = v_lead_id;
    
    RAISE NOTICE 'Legacy service_type: %', v_service_type_name;
    
    IF v_service_type_name IS NOT NULL AND v_service_type_name != '' THEN
      SELECT generate_service_checklist(
        v_lead_id,
        v_mechanic_id,
        v_service_type_name
      ) INTO v_checklist_id;
      
      RAISE NOTICE 'Checklist generated with legacy service_type, ID: %', v_checklist_id;
    END IF;
  END IF;
END $$;

-- Also, let's check all leads with Basic Service that don't have checklists
SELECT 
  sl.id as lead_id,
  sl.lead_number,
  mj.mechanic_id,
  sl.service_type_ids,
  st.name as service_type_name,
  CASE 
    WHEN sc.id IS NULL THEN '❌ No Checklist'
    WHEN sc.checklist_items IS NULL OR jsonb_array_length(sc.checklist_items) = 0 THEN '⚠️ Empty Checklist'
    ELSE '✅ Has Checklist (' || jsonb_array_length(sc.checklist_items) || ' items)'
  END as checklist_status
FROM service_leads sl
JOIN mechanic_jobs mj ON mj.lead_id = sl.id
LEFT JOIN service_types st ON st.id = (sl.service_type_ids->>0)::uuid
LEFT JOIN service_checklists sc ON sc.lead_id = sl.id AND sc.mechanic_id = mj.mechanic_id
WHERE mj.mechanic_id IS NOT NULL
  AND (
    st.name ILIKE '%Basic Service%' OR
    sl.service_type ILIKE '%Basic Service%'
  )
ORDER BY sl.created_at DESC
LIMIT 10;

