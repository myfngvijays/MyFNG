-- ============================================
-- Update generate_service_checklist function
-- Add "Basic Service (15 Points)" checklist
-- ============================================

-- Update the function to include Basic Service (15 Points) checklist
CREATE OR REPLACE FUNCTION generate_service_checklist(
  p_lead_id uuid,
  p_mechanic_id uuid,
  p_service_type varchar
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_checklist_id uuid;
  v_checklist_items jsonb;
BEGIN
  -- Generate checklist items based on service type
  -- Check for "Basic Service (15 Points)" by name (case-insensitive)
  CASE 
    WHEN UPPER(p_service_type) LIKE '%BASIC SERVICE%15 POINTS%' OR 
         UPPER(p_service_type) = 'BASIC SERVICE (15 POINTS)' OR
         p_service_type = 'Basic Service (15 Points)' THEN
      v_checklist_items := '[
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
      ]'::jsonb;
    WHEN 'FULL_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "Engine oil drained", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Oil filter replaced", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Air filter inspected/replaced", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Brake system checked", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Coolant level checked", "status": "PENDING", "mandatory": true},
        {"id": "6", "name": "Battery terminals cleaned", "status": "PENDING", "mandatory": false},
        {"id": "7", "name": "Tyre pressure corrected", "status": "PENDING", "mandatory": true},
        {"id": "8", "name": "AC filter cleaned", "status": "PENDING", "mandatory": false},
        {"id": "9", "name": "Suspension inspected", "status": "PENDING", "mandatory": true},
        {"id": "10", "name": "Test drive completed", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    WHEN 'AC_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "AC filter cleaned/replaced", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "AC gas level checked", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Cooling performance tested", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Condenser cleaned", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Blower motor checked", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    WHEN 'BRAKE_SERVICE' THEN
      v_checklist_items := '[
        {"id": "1", "name": "Brake pads inspected", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Brake fluid checked", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Brake drums/rotors checked", "status": "PENDING", "mandatory": true},
        {"id": "4", "name": "Brake lines inspected", "status": "PENDING", "mandatory": true},
        {"id": "5", "name": "Brake test completed", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
    ELSE
      v_checklist_items := '[
        {"id": "1", "name": "Service inspection completed", "status": "PENDING", "mandatory": true},
        {"id": "2", "name": "Required work performed", "status": "PENDING", "mandatory": true},
        {"id": "3", "name": "Quality check done", "status": "PENDING", "mandatory": true}
      ]'::jsonb;
  END CASE;
  
  -- Insert checklist
  INSERT INTO public.service_checklists (
    lead_id,
    mechanic_id,
    service_type,
    checklist_items,
    total_items,
    completed_items,
    completion_percentage
  )
  VALUES (
    p_lead_id,
    p_mechanic_id,
    p_service_type,
    v_checklist_items,
    jsonb_array_length(v_checklist_items),
    0,
    0
  )
  RETURNING id INTO v_checklist_id;
  
  RETURN v_checklist_id;
END;
$$;

-- Update the trigger function to use service type name from service_types table
CREATE OR REPLACE FUNCTION auto_generate_mechanic_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_type_name varchar;
  v_service_type_ids jsonb;
BEGIN
  -- Only generate checklist when mechanic is assigned
  IF NEW.mechanic_id IS NOT NULL AND OLD.mechanic_id IS NULL THEN
    -- Get service type name from service_leads
    SELECT service_type_ids INTO v_service_type_ids
    FROM service_leads
    WHERE id = NEW.lead_id;
    
    -- If service_type_ids exists, get the first service type name
    IF v_service_type_ids IS NOT NULL AND jsonb_array_length(v_service_type_ids) > 0 THEN
      SELECT name INTO v_service_type_name
      FROM service_types
      WHERE id = (v_service_type_ids->>0)::uuid
      LIMIT 1;
      
      -- If found, use the name; otherwise use the first ID as string
      IF v_service_type_name IS NULL THEN
        v_service_type_name := v_service_type_ids->>0;
      END IF;
    ELSE
      -- Fallback to legacy service_type column
      SELECT service_type INTO v_service_type_name
      FROM service_leads
      WHERE id = NEW.lead_id;
    END IF;
    
    -- Generate checklist with service type name
    IF v_service_type_name IS NOT NULL THEN
      PERFORM generate_service_checklist(
        NEW.lead_id,
        NEW.mechanic_id,
        v_service_type_name
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION generate_service_checklist IS 'Generates service checklist based on service type. Supports Basic Service (15 Points) with 15 items including remarks.';

