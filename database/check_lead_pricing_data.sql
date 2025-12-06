-- ============================================
-- CHECK LEAD PRICING DATA
-- Purpose: Check all pricing-related data for a specific lead
-- Usage: Replace '184edadd-f1e9-45d8-8cc3-056fb9f1578f' with actual lead ID
-- ============================================

-- CHANGE THIS LEAD ID BELOW (replace in all queries):
-- Replace '184edadd-f1e9-45d8-8cc3-056fb9f1578f' with your lead ID

-- ============================================
-- 1. Lead Basic Info & Amount Fields
-- ============================================
SELECT 
    id,
    lead_number,
    status,
    workshop_id,
    estimated_cost,
    estimated_amount,
    actual_amount,
    final_amount,
    total_price,
    discount_amount,
    tax_amount,
    coupon_code
FROM service_leads
WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 2. Lead Pricing Items (Service Pricing)
-- ============================================
SELECT 
    id,
    item_name,
    item_description,
    base_price,
    final_price,
    qty,
    discount_percentage,
    tax_percentage,
    is_addon,
    status,
    created_at
FROM lead_pricing_items
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid
ORDER BY created_at;

-- Summary of pricing items
SELECT 
    COUNT(*) as total_items,
    SUM(final_price) as total_pricing_items_amount,
    SUM(CASE WHEN status = 'ACTIVE' THEN final_price ELSE 0 END) as active_items_amount
FROM lead_pricing_items
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 3. Job Card & Parts
-- ============================================
SELECT 
    jc.id as job_card_id,
    jc.job_card_number,
    jc.labor_charges,
    jc.additional_work,
    jc.mechanic_notes,
    jc.created_at as job_card_created_at
FROM job_cards jc
WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- Job Card Parts with Pricing
SELECT 
    jcp.id,
    jcp.part_name,
    jcp.part_number,
    jcp.quantity,
    jcp.unit_price,
    jcp.total_price,
    jcp.created_at
FROM job_card_parts jcp
INNER JOIN job_cards jc ON jcp.job_card_id = jc.id
WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid
ORDER BY jcp.created_at;

-- Summary of parts
SELECT 
    COUNT(*) as total_parts,
    SUM(quantity) as total_quantity,
    SUM(total_price) as total_parts_cost
FROM job_card_parts jcp
INNER JOIN job_cards jc ON jcp.job_card_id = jc.id
WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 4. Extra Charges
-- ============================================
SELECT 
    id,
    description,
    amount,
    status,
    approved_by,
    approved_at,
    created_at
FROM lead_extra_charges
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid
ORDER BY created_at;

-- Summary of extra charges
SELECT 
    COUNT(*) as total_extra_charges,
    SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END) as approved_charges_total,
    SUM(amount) as all_charges_total
FROM lead_extra_charges
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 5. Existing Invoice (if any)
-- ============================================
SELECT 
    id,
    invoice_number,
    base_amount,
    extra_charges,
    parts_cost,
    labour_cost,
    sub_total,
    discount_amount,
    total_tax,
    final_amount,
    total_amount,
    status,
    payment_status,
    created_at
FROM invoices
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 6. COMPREHENSIVE SUMMARY
-- ============================================
SELECT 
    'Lead Amount Fields' as source,
    COALESCE(estimated_cost, 0) as estimated_cost,
    COALESCE(estimated_amount, 0) as estimated_amount,
    COALESCE(actual_amount, 0) as actual_amount,
    COALESCE(final_amount, 0) as final_amount,
    COALESCE(total_price, 0) as total_price
FROM service_leads
WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid

UNION ALL

SELECT 
    'Pricing Items Total' as source,
    0 as estimated_cost,
    0 as estimated_amount,
    0 as actual_amount,
    0 as final_amount,
    COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN final_price ELSE 0 END), 0) as total_price
FROM lead_pricing_items
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid

UNION ALL

SELECT 
    'Job Card Labor' as source,
    0 as estimated_cost,
    0 as estimated_amount,
    0 as actual_amount,
    0 as final_amount,
    COALESCE(SUM(labor_charges), 0) as total_price
FROM job_cards
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid

UNION ALL

SELECT 
    'Parts Total' as source,
    0 as estimated_cost,
    0 as estimated_amount,
    0 as actual_amount,
    0 as final_amount,
    COALESCE(SUM(jcp.total_price), 0) as total_price
FROM job_card_parts jcp
INNER JOIN job_cards jc ON jcp.job_card_id = jc.id
WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid

UNION ALL

SELECT 
    'Extra Charges Total' as source,
    0 as estimated_cost,
    0 as estimated_amount,
    0 as actual_amount,
    0 as final_amount,
    COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as total_price
FROM lead_extra_charges
WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid;

-- ============================================
-- 7. FINAL CALCULATION PREVIEW
-- ============================================
WITH pricing_data AS (
    SELECT 
        -- Lead amounts
        COALESCE((SELECT estimated_cost FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as lead_estimated_cost,
        COALESCE((SELECT estimated_amount FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as lead_estimated_amount,
        COALESCE((SELECT actual_amount FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as lead_actual_amount,
        COALESCE((SELECT final_amount FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as lead_final_amount,
        COALESCE((SELECT total_price FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as lead_total_price,
        
        -- Pricing items
        COALESCE((SELECT SUM(final_price) FROM lead_pricing_items WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid AND status = 'ACTIVE'), 0) as pricing_items_total,
        
        -- Job card labor
        COALESCE((SELECT SUM(labor_charges) FROM job_cards WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as labor_charges_total,
        
        -- Parts
        COALESCE((SELECT SUM(jcp.total_price) FROM job_card_parts jcp INNER JOIN job_cards jc ON jcp.job_card_id = jc.id WHERE jc.lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as parts_total,
        
        -- Extra charges
        COALESCE((SELECT SUM(amount) FROM lead_extra_charges WHERE lead_id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid AND status = 'APPROVED'), 0) as extra_charges_total,
        
        -- Discount
        COALESCE((SELECT discount_amount FROM service_leads WHERE id = '184edadd-f1e9-45d8-8cc3-056fb9f1578f'::uuid), 0) as discount_amount
)
SELECT 
    'Base Amount Calculation' as calculation_step,
    pricing_items_total as pricing_items,
    lead_estimated_amount as estimated_amount,
    lead_estimated_cost as estimated_cost,
    lead_actual_amount as actual_amount,
    lead_final_amount as final_amount,
    lead_total_price as total_price,
    labor_charges_total as labor_charges,
    CASE 
        WHEN pricing_items_total > 0 THEN pricing_items_total
        WHEN lead_estimated_amount > 0 THEN lead_estimated_amount
        WHEN lead_estimated_cost > 0 THEN lead_estimated_cost
        WHEN lead_actual_amount > 0 THEN lead_actual_amount
        WHEN lead_final_amount > 0 THEN lead_final_amount
        WHEN lead_total_price > 0 THEN lead_total_price
        WHEN labor_charges_total > 0 THEN labor_charges_total
        ELSE 0
    END as calculated_base_amount,
    parts_total,
    extra_charges_total,
    discount_amount,
    (CASE 
        WHEN pricing_items_total > 0 THEN pricing_items_total
        WHEN lead_estimated_amount > 0 THEN lead_estimated_amount
        WHEN lead_estimated_cost > 0 THEN lead_estimated_cost
        WHEN lead_actual_amount > 0 THEN lead_actual_amount
        WHEN lead_final_amount > 0 THEN lead_final_amount
        WHEN lead_total_price > 0 THEN lead_total_price
        WHEN labor_charges_total > 0 THEN labor_charges_total
        ELSE 0
    END + parts_total + extra_charges_total - discount_amount) as calculated_subtotal
FROM pricing_data;

