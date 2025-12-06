-- ============================================
-- QUICK CHECK LEAD PRICING DATA
-- Replace '184edadd-f1e9-45d8-8cc3-056fb9f1578f' with your lead ID
-- ============================================

-- Quick Summary
-- CHANGE THIS LEAD ID BELOW:
WITH lead_id_var AS (SELECT '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid as lead_id)
SELECT 
    'Lead Amounts' as source,
    COALESCE(estimated_cost, 0) as estimated_cost,
    COALESCE(estimated_amount, 0) as estimated_amount,
    COALESCE(actual_amount, 0) as actual_amount,
    COALESCE(final_amount, 0) as final_amount,
    COALESCE(total_price, 0) as total_price
FROM service_leads, lead_id_var
WHERE service_leads.id = lead_id_var.lead_id

UNION ALL

SELECT 
    'Pricing Items' as source,
    0, 0, 0, 0,
    COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN final_price ELSE 0 END), 0)
FROM lead_pricing_items, lead_id_var
WHERE lead_pricing_items.lead_id = lead_id_var.lead_id

UNION ALL

SELECT 
    'Job Card Labor' as source,
    0, 0, 0, 0,
    COALESCE(SUM(labor_charges), 0)
FROM job_cards, lead_id_var
WHERE job_cards.lead_id = lead_id_var.lead_id

UNION ALL

SELECT 
    'Parts' as source,
    0, 0, 0, 0,
    COALESCE(SUM(jcp.total_price), 0)
FROM job_card_parts jcp
INNER JOIN job_cards jc ON jcp.job_card_id = jc.id
CROSS JOIN lead_id_var
WHERE jc.lead_id = lead_id_var.lead_id

UNION ALL

SELECT 
    'Extra Charges' as source,
    0, 0, 0, 0,
    COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)
FROM lead_extra_charges, lead_id_var
WHERE lead_extra_charges.lead_id = lead_id_var.lead_id;

-- Detailed Parts List
-- CHANGE THIS LEAD ID BELOW:
SELECT 
    jcp.part_name,
    jcp.quantity,
    jcp.unit_price,
    jcp.total_price
FROM job_card_parts jcp
INNER JOIN job_cards jc ON jcp.job_card_id = jc.id
WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

