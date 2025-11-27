-- ============================================
-- Add "Premium Service (50 Points)" checklist
-- ============================================

-- Update the generate_service_checklist function to include Premium Service (50 Points)
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
  CASE 
    -- Premium Service (50 Points)
    WHEN UPPER(p_service_type) LIKE '%PREMIUM SERVICE%50 POINTS%' OR 
         UPPER(p_service_type) = 'PREMIUM SERVICE (50 POINTS)' OR
         p_service_type = 'Premium Service (50 Points)' THEN
      v_checklist_items := '[
        {"id": "1", "name": "Clean Air Filter", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "2", "name": "Spark Plugs Cleaning & Adjustment", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "3", "name": "Top up Brake Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "4", "name": "Top up Gear Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "5", "name": "Top up Power Steering Oil & Clutch Oil (If applicable)", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "6", "name": "Battery Terminal Cleaning", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "7", "name": "Battery Load Testing", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "8", "name": "Battery Terminal Coating", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "9", "name": "Top up Battery Water", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "10", "name": "Top up Coolant", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "11", "name": "Top up Wiper Water Tank with Screen Wash", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "12", "name": "Align Wiper Water Nozzles", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "13", "name": "Replace Oil Filter", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "14", "name": "Replace Engine Oil", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "15", "name": "Check all Radiator Lines & Hoses", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "16", "name": "Inspect Belts for Cracks & Hardness / Adjustment of Tensioners", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "17", "name": "Check and Adjust Clutch play (if required)", "status": "PENDING", "mandatory": true, "category": "Engine Compartment", "remark": ""},
        {"id": "18", "name": "Check All Glass Winder Operations", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "19", "name": "Window Glass Run Channel Lubrication", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "20", "name": "Clean AC Filter", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "21", "name": "Check AC Cooling\\Gas Leak Test", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "22", "name": "AC Disinfectant Spray in AC Vents", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "23", "name": "Inspect Front Lights, Rear Lights & Indicators", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "24", "name": "Inspect Internal Lights & Power Switches", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "25", "name": "Interior Vacuuming", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "26", "name": "Dashboard Polish", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "27", "name": "Pre Greasing - ABRO AB80 Anti Squeak Spray on Door Hinges", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "28", "name": "Greasing on Door Hinges", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "29", "name": "Check Door Locks & Central Locking System", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "30", "name": "Door Locks Lubrication", "status": "PENDING", "mandatory": true, "category": "Cabin", "remark": ""},
        {"id": "31", "name": "All Wheel Nuts & Bolts Greasing", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "32", "name": "Front Brake Pads Cleaning", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "33", "name": "Front Brake Calliper Pins Lubrication", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "34", "name": "Rear Brake Pads\\Liners Cleaning", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "35", "name": "Rear Brake Calliper Pins Lubrication\\Liners Setting", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "36", "name": "Air Bleeding from Brake Fluid Lines", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "37", "name": "Hand Brake Setting", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "38", "name": "Check Wheel Bearings", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "39", "name": "Check Ball Joints, Steering Rack, Lower Arms, Linkages & Boots", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "40", "name": "Inspect Front Shock Absorbers, Suspension Struts, Balance Rod Bushes & Lower Arms", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "41", "name": "Inspect Rear Shock Absorbers, Buffer Bushes & Coil Pads", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "42", "name": "Re-torque all Nuts and Bolts on Chassis & Body", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "43", "name": "Check all Tyres & Rims", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "44", "name": "Inspect all Wheel Arcs & Entire Under Body", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "45", "name": "Tyre Rotation", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "46", "name": "Final Wheel Nuts Torque", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "47", "name": "Top up Tyre Pressure", "status": "PENDING", "mandatory": true, "category": "Wheel & Brakes", "remark": ""},
        {"id": "48", "name": "Trial Drive, Diagnostics Scanning & FINAL INSPECTION POST TRIAL DRIVE", "status": "PENDING", "mandatory": true, "category": "Others", "remark": ""},
        {"id": "49", "name": "Wash", "status": "PENDING", "mandatory": true, "category": "Others", "remark": ""},
        {"id": "50", "name": "Comprehensive Report", "status": "PENDING", "mandatory": true, "category": "Others", "remark": ""}
      ]'::jsonb;
    -- Basic Service (15 Points)
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

COMMENT ON FUNCTION generate_service_checklist IS 'Generates service checklist based on service type. Supports Basic Service (15 Points) and Premium Service (50 Points) with categories and remarks.';

