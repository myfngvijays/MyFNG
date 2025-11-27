-- Direct SQL test to verify data access works
-- This bypasses PostgREST API

-- ============================================
-- Test 1: Can we query the table directly?
-- ============================================
SELECT 
  'Direct SQL Query' as test_type,
  id,
  lead_id,
  job_card_number
FROM public.job_cards
LIMIT 5;

-- ============================================
-- Test 2: Can we query specific lead?
-- ============================================
SELECT 
  'Specific Lead Query' as test_type,
  id,
  lead_id,
  job_card_number,
  labor_charges
FROM public.job_cards
WHERE lead_id = 'cf0c5caa-7cfd-4c42-8804-d0f3c9594c2a';

-- ============================================
-- Test 3: Check if table has any data
-- ============================================
SELECT 
  'Table Data Check' as test_type,
  COUNT(*) as total_job_cards,
  COUNT(DISTINCT lead_id) as distinct_leads
FROM public.job_cards;

-- ============================================
-- Test 4: Check table structure
-- ============================================
SELECT 
  'Table Structure' as test_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'job_cards'
ORDER BY ordinal_position;

