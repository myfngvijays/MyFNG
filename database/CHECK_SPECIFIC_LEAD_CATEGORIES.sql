-- Check if this specific lead's checklist has categories
SELECT 
  id,
  lead_id,
  jsonb_array_length(checklist_items) as total_items,
  (SELECT jsonb_agg(DISTINCT item->>'category')
   FROM jsonb_array_elements(checklist_items) as item) as categories,
  (SELECT item->>'category'
   FROM jsonb_array_elements(checklist_items) as item
   LIMIT 1) as first_item_category,
  checklist_items->0->>'name' as first_item_name,
  checklist_items->0->>'category' as first_item_cat
FROM service_checklists
WHERE lead_id = 'a500c952-b11c-4fae-8acc-ae98779c8f2d';


