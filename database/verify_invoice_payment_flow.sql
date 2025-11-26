-- ============================================
-- VERIFICATION SCRIPT - Invoice & Payment Flow
-- Run this to verify all tables and columns exist
-- ============================================

-- Check if payment_transactions table exists and has all columns
SELECT 
    'payment_transactions' as table_name,
    CASE WHEN EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'payment_transactions'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as table_status,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        AND column_name = 'payment_received_by'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as payment_received_by,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        AND column_name = 'payment_remarks'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as payment_remarks,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'payment_transactions' 
        AND column_name = 'staff_name'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as staff_name;

-- Check if invoice_reviews table exists
SELECT 
    'invoice_reviews' as table_name,
    CASE WHEN EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'invoice_reviews'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as table_status;

-- Check if invoice_sharing_logs table exists
SELECT 
    'invoice_sharing_logs' as table_name,
    CASE WHEN EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'invoice_sharing_logs'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as table_status;

-- Check invoices table new columns
SELECT 
    'invoices' as table_name,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'invoice_approved'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as invoice_approved,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'payment_received_by'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as payment_received_by,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'payment_remarks'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as payment_remarks,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'place_of_supply'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as place_of_supply,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'line_items'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as line_items,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'hsn_sac_codes'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as hsn_sac_codes;

-- Count indexes
SELECT 
    'Indexes' as check_type,
    COUNT(*) as total_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (
    indexname LIKE 'idx_payment_transactions%' OR
    indexname LIKE 'idx_invoice_reviews%' OR
    indexname LIKE 'idx_invoice_sharing_logs%' OR
    indexname LIKE 'idx_invoices_invoice_approved' OR
    indexname LIKE 'idx_invoices_payment_received_by'
);

-- Summary
SELECT 
    '✅ VERIFICATION COMPLETE' as status,
    'All tables and columns should be checked above' as note;

