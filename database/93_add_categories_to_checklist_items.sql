-- Add categories to existing checklist items
-- This SQL updates all existing checklists to include category grouping

-- Update service_checklists table with categorized items
UPDATE service_checklists
SET checklist_items = (
  SELECT jsonb_agg(
    CASE 
      -- Engine Compartment Category
      WHEN item->>'name' LIKE '%Engine%' OR item->>'name' LIKE '%Oil%' OR item->>'name' LIKE '%Filter%' OR item->>'name' LIKE '%Coolant%' OR item->>'name' LIKE '%Radiator%' OR item->>'name' LIKE '%Belt%' OR item->>'name' LIKE '%Hose%' OR item->>'name' LIKE '%Clutch%' 
      THEN jsonb_set(item, '{category}', '"Engine Compartment"')
      
      -- Cabin Category
      WHEN item->>'name' LIKE '%Cabin%' OR item->>'name' LIKE '%Dashboard%' OR item->>'name' LIKE '%AC%' OR item->>'name' LIKE '%Air Condition%' OR item->>'name' LIKE '%Wiper%' OR item->>'name' LIKE '%Glass%' OR item->>'name' LIKE '%Window%' OR item->>'name' LIKE '%Horn%' OR item->>'name' LIKE '%Seat%'
      THEN jsonb_set(item, '{category}', '"Cabin"')
      
      -- Wheels & Brakes Category
      WHEN item->>'name' LIKE '%Brake%' OR item->>'name' LIKE '%Wheel%' OR item->>'name' LIKE '%Tyre%' OR item->>'name' LIKE '%Tire%' OR item->>'name' LIKE '%Suspension%'
      THEN jsonb_set(item, '{category}', '"Wheels & Brakes"')
      
      -- Exterior Category
      WHEN item->>'name' LIKE '%Light%' OR item->>'name' LIKE '%Headlight%' OR item->>'name' LIKE '%Taillight%' OR item->>'name' LIKE '%Body%' OR item->>'name' LIKE '%Paint%' OR item->>'name' LIKE '%Mirror%' OR item->>'name' LIKE '%Door%'
      THEN jsonb_set(item, '{category}', '"Exterior"')
      
      -- Electrical Category
      WHEN item->>'name' LIKE '%Battery%' OR item->>'name' LIKE '%Electrical%' OR item->>'name' LIKE '%Wiring%' OR item->>'name' LIKE '%Fuse%' OR item->>'name' LIKE '%Indicator%'
      THEN jsonb_set(item, '{category}', '"Electrical"')
      
      -- Default to General
      ELSE jsonb_set(item, '{category}', '"General"')
    END
  )
  FROM jsonb_array_elements(checklist_items) AS item
)
WHERE checklist_items IS NOT NULL
  AND jsonb_typeof(checklist_items) = 'array'
  AND jsonb_array_length(checklist_items) > 0;

-- Verify update
SELECT 
  id,
  lead_id,
  jsonb_array_length(checklist_items) as item_count,
  (SELECT count(DISTINCT item->>'category') 
   FROM jsonb_array_elements(checklist_items) as item) as category_count,
  (SELECT jsonb_agg(DISTINCT item->>'category')
   FROM jsonb_array_elements(checklist_items) as item) as categories
FROM service_checklists
WHERE checklist_items IS NOT NULL
  AND jsonb_array_length(checklist_items) > 0
LIMIT 5;


