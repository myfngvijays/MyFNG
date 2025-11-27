-- ============================================
-- Update service type name and generate checklist for specific lead
-- ============================================

-- Step 0: Add service_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_checklists' 
    AND column_name = 'service_type'
  ) THEN
    ALTER TABLE public.service_checklists 
    ADD COLUMN service_type varchar;
    
    RAISE NOTICE '✅ Added service_type column to service_checklists table';
  ELSE
    RAISE NOTICE '✅ service_type column already exists';
  END IF;
END $$;

-- Step 1: Update service type name to "Basic Service (15 Points)"
UPDATE service_types 
SET name = 'Basic Service (15 Points)', 
    description = 'Basic maintenance package with 15 checkpoints'
WHERE id = 'd0000001-0001-0001-0001-000000000001';

-- Step 2: Generate checklist for the specific lead
-- Lead ID: 94b886e6-7054-4885-b163-cb3275c2f627
-- Mechanic ID: 7fa49f5a-08e3-428e-8e6a-f4794e827302 (from assigned_mechanic_id)

-- First, check if checklist already exists
DO $$
DECLARE
  v_lead_id uuid := '94b886e6-7054-4885-b163-cb3275c2f627';
  v_mechanic_id uuid := '7fa49f5a-08e3-428e-8e6a-f4794e827302';
  v_checklist_exists boolean;
  v_checklist_id uuid;
BEGIN
  -- Check if checklist exists
  SELECT EXISTS(
    SELECT 1 FROM service_checklists 
    WHERE lead_id = v_lead_id
  ) INTO v_checklist_exists;
  
  -- If checklist doesn't exist, create it
  IF NOT v_checklist_exists THEN
    -- Generate checklist using the function
    SELECT generate_service_checklist(
      v_lead_id,
      v_mechanic_id,
      'Basic Service (15 Points)'
    ) INTO v_checklist_id;
    
    RAISE NOTICE '✅ Checklist generated for lead % with ID: %', v_lead_id, v_checklist_id;
  ELSE
    RAISE NOTICE '⚠️ Checklist already exists for lead %', v_lead_id;
    
    -- Update existing checklist to Basic Service (15 Points) format
    UPDATE service_checklists
    SET 
      service_type = 'Basic Service (15 Points)',
      checklist_items = '[
        {"id": "1", "name": "Clean Air Filter", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "2", "name": "Spark Plugs Servicing", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "3", "name": "Top up Brake Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "4", "name": "Top up Gear Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "5", "name": "Top up Power Steering Oil & Clutch Oil (If applicable)", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "6", "name": "Top up Coolant", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "7", "name": "Top up Battery Water", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "8", "name": "Top up Wiper Water Tank", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "9", "name": "Replace Oil Filter", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "10", "name": "Replace Engine Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "11", "name": "Clean Cabin AC Filter", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "12", "name": "Interior Vacuuming", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "13", "name": "Grease Door Hinges", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "14", "name": "Inspect & Top up Tyre Pressure", "status": "PENDING", "mandatory": true, "category": "Others", "remark": ""},
        {"id": "15", "name": "Body Wash", "status": "PENDING", "mandatory": true, "category": "Others", "remark": ""}
      ]'::jsonb,
      total_items = 15,
      completed_items = 0,
      completion_percentage = 0,
      all_mandatory_completed = false,
      updated_at = now()
    WHERE lead_id = v_lead_id;
    
    RAISE NOTICE '✅ Checklist updated for lead %', v_lead_id;
  END IF;
END $$;

-- Verify the update
SELECT 
  st.id,
  st.name as service_type_name,
  sc.id as checklist_id,
  sc.service_type as checklist_service_type,
  jsonb_array_length(sc.checklist_items) as total_items,
  sc.completed_items,
  sc.completion_percentage
FROM service_types st
LEFT JOIN service_checklists sc ON sc.lead_id = '94b886e6-7054-4885-b163-cb3275c2f627'
WHERE st.id = 'd0000001-0001-0001-0001-000000000001';

