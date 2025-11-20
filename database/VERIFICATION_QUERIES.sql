-- ================================================================
-- 🔍 VERIFICATION QUERIES - Run these to confirm migration success
-- ================================================================
-- Copy and paste each section into Supabase SQL Editor to verify
-- ================================================================

-- ================================================================
-- 1️⃣ VERIFY NEW COLUMNS IN service_leads TABLE
-- ================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name IN (
    'validated_by_id',
    'validated_at',
    'validation_notes',
    'lead_manager_assigned_id',
    'lead_manager_assigned_at',
    'assigned_to_workshop_at',
    'workshop_accepted_by',
    'assigned_by_workshop_admin_id',
    'audit_performed_by',
    'audit_performed_at',
    'invoice_generated_by',
    'invoice_generated_at',
    'invoice_sent_at',
    'cse_assigned_id',
    'cse_assigned_at',
    'cse_followup_completed',
    'cse_followup_notes',
    'customer_satisfaction_score',
    'final_closure_at',
    'closed_by',
    'mechanic_started_at',
    'mechanic_completed_at',
    'payment_collected_by',
    'payment_collected_at'
)
ORDER BY column_name;

-- Expected: Should return 24 rows (all new columns)

-- ================================================================
-- 2️⃣ VERIFY NEW LEAD STATUS VALUES
-- ================================================================

SELECT enumlabel as status_value, enumsortorder as order_number
FROM pg_enum 
WHERE enumtypid = 'lead_status'::regtype
ORDER BY enumsortorder;

-- Expected: Should include VALIDATED, ASSIGNED_TO_WORKSHOP, MECHANIC_WORKING, 
-- AWAITING_QC, QC_APPROVED, QC_FAILED, READY_FOR_BILLING, INVOICE_GENERATED, 
-- AWAITING_DELIVERY, CLOSED

-- ================================================================
-- 3️⃣ VERIFY NEW TABLES WERE CREATED
-- ================================================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'cse_followups',
    'customer_complaints',
    'billing_team_actions',
    'cse_performance_metrics',
    'lead_status_history'
)
ORDER BY table_name;

-- Expected: Should return 5 rows (all new tables)

-- ================================================================
-- 4️⃣ VERIFY NEW COLUMNS IN invoices TABLE
-- ================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND column_name IN (
    'workshop_id',
    'sent_at',
    'sent_via',
    'customer_viewed_at',
    'revised_count',
    'cancelled_at',
    'cancellation_reason'
)
ORDER BY column_name;

-- Expected: Should return 7 rows

-- ================================================================
-- 5️⃣ VERIFY FOREIGN KEY CONSTRAINTS
-- ================================================================

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'service_leads'
AND kcu.column_name IN (
    'validated_by_id',
    'lead_manager_assigned_id',
    'workshop_accepted_by',
    'assigned_by_workshop_admin_id',
    'audit_performed_by',
    'invoice_generated_by',
    'cse_assigned_id',
    'closed_by',
    'payment_collected_by'
)
ORDER BY kcu.column_name;

-- Expected: Should return 9 rows (all FK constraints to users_login)

-- ================================================================
-- 6️⃣ VERIFY INDEXES WERE CREATED
-- ================================================================

SELECT
    indexname as index_name,
    tablename as table_name,
    indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_service_leads_validated%'
    OR indexname LIKE 'idx_service_leads_lead_manager%'
    OR indexname LIKE 'idx_service_leads_cse%'
    OR indexname LIKE 'idx_service_leads_invoice%'
    OR indexname LIKE 'idx_service_leads_customer%'
    OR indexname LIKE 'idx_cse_followups%'
    OR indexname LIKE 'idx_customer_complaints%'
    OR indexname LIKE 'idx_billing_actions%'
)
ORDER BY tablename, indexname;

-- Expected: Should return multiple indexes for performance

-- ================================================================
-- 7️⃣ VERIFY lead_flow_dashboard VIEW
-- ================================================================

SELECT * FROM lead_flow_dashboard LIMIT 5;

-- Expected: Should show leads with all new columns (may be empty if no leads exist)

-- ================================================================
-- 8️⃣ VERIFY COMPLAINT NUMBER SEQUENCE
-- ================================================================

SELECT 
    sequence_name,
    last_value,
    increment_by
FROM information_schema.sequences
WHERE sequence_name = 'complaint_number_seq';

-- Expected: Should show complaint_number_seq with last_value = 10000001

-- ================================================================
-- 9️⃣ CHECK TABLE STRUCTURE - cse_followups
-- ================================================================

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'cse_followups'
ORDER BY ordinal_position;

-- Expected: Should show all columns with correct data types

-- ================================================================
-- 🔟 CHECK TABLE STRUCTURE - customer_complaints
-- ================================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customer_complaints'
ORDER BY ordinal_position;

-- Expected: Should show all columns with correct data types

-- ================================================================
-- 1️⃣1️⃣ VERIFY TRIGGER FOR COMPLAINT NUMBER GENERATION
-- ================================================================

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_generate_complaint_number';

-- Expected: Should show the trigger on customer_complaints table

-- ================================================================
-- 1️⃣2️⃣ COUNT ALL TABLES IN DATABASE
-- ================================================================

SELECT 
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- Expected: Should show 40+ tables

-- ================================================================
-- 1️⃣3️⃣ SUMMARY: List all tables
-- ================================================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- This gives you a complete overview of your database

-- ================================================================
-- ✅ VERIFICATION COMPLETE!
-- ================================================================
-- If all queries above return expected results, your migration 
-- was 100% successful! 🎉
-- ================================================================

