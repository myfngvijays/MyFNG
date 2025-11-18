-- 🔍 COMPLETE DIAGNOSTIC CHECK FOR service_leads TABLE
-- Run this in Supabase SQL Editor to see exact table state

-- 1. Check if service_leads table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'service_leads'
) as table_exists;

-- 2. Check ALL columns in service_leads table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'service_leads'
ORDER BY ordinal_position;

-- 3. Specifically check the PROBLEMATIC columns
SELECT 
  column_name,
  data_type,
  CASE 
    WHEN column_name IN ('is_incomplete', 'reopen_count', 'sla_state', 'workshop_id', 
                          'follow_up_required', 'pickup_required', 'pickup_status', 
                          'assigned_telecaller_id', 'sla_expires_at')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'service_leads'
AND column_name IN (
  'is_incomplete', 
  'reopen_count', 
  'sla_state', 
  'workshop_id',
  'follow_up_required',
  'pickup_required',
  'pickup_status',
  'assigned_telecaller_id',
  'sla_expires_at',
  'escalation'
)
ORDER BY column_name;

-- 4. Check total column count
SELECT COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'service_leads';

-- 5. Check if there's a column named 'assigned_workshop_id' (old name)
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'service_leads'
AND column_name LIKE '%workshop%';

