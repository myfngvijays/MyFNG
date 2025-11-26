-- ============================================
-- PHASE 1: VERIFICATION QUERIES
-- Purpose: Verify all Phase 1 migrations are applied
-- Date: November 26, 2025
-- ============================================

-- Check if all tables exist
SELECT 
  'finance_events' as table_name,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'finance_events') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status
UNION ALL
SELECT 
  'short_urls' as table_name,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'short_urls') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status
UNION ALL
SELECT 
  'payment_intents' as table_name,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_intents') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status
UNION ALL
SELECT 
  'workshop_payment_policy' as table_name,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workshop_payment_policy') 
    THEN '✓ EXISTS' 
    ELSE '✗ MISSING' 
  END as status;

-- Check invoice table columns
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name IN (
    'send_failures', 'balance_due', 'requires_second_approval', 
    'second_approval_threshold', 'second_approver_id', 
    'second_approved_at', 'customer_gstin', 'receipt_url', 
    'receipt_generated_at', 'cod_due_date'
  ) THEN '✓ NEW COLUMN' ELSE 'Existing' END as status
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN (
    'send_failures', 'balance_due', 'requires_second_approval', 
    'second_approval_threshold', 'second_approver_id', 
    'second_approved_at', 'customer_gstin', 'receipt_url', 
    'receipt_generated_at', 'cod_due_date'
  )
ORDER BY column_name;

-- Check payment_transactions table columns
SELECT 
  column_name,
  data_type,
  CASE WHEN column_name IN (
    'reconciled', 'reconciled_at', 'reconciled_by', 
    'cash_deposit_pending', 'bank_deposit_slip_url'
  ) THEN '✓ NEW COLUMN' ELSE 'Existing' END as status
FROM information_schema.columns
WHERE table_name = 'payment_transactions'
  AND column_name IN (
    'reconciled', 'reconciled_at', 'reconciled_by', 
    'cash_deposit_pending', 'bank_deposit_slip_url'
  )
ORDER BY column_name;

-- Check indexes
SELECT 
  indexname,
  tablename,
  '✓ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_finance_events_event_type',
    'idx_finance_events_entity_type',
    'idx_finance_events_entity_id',
    'idx_short_urls_short_code',
    'idx_payment_intents_invoice_id',
    'idx_workshop_payment_policy_workshop_id',
    'idx_invoices_requires_second_approval',
    'idx_invoices_balance_due'
  )
ORDER BY tablename, indexname;

-- Summary
SELECT 
  'PHASE 1 MIGRATION VERIFICATION' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('finance_events', 'short_urls', 'payment_intents', 'workshop_payment_policy')) as tables_created,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'invoices' AND column_name IN ('send_failures', 'balance_due', 'requires_second_approval', 'second_approval_threshold', 'second_approver_id', 'second_approved_at', 'customer_gstin', 'receipt_url', 'receipt_generated_at', 'cod_due_date')) as invoice_columns_added,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'payment_transactions' AND column_name IN ('reconciled', 'reconciled_at', 'reconciled_by', 'cash_deposit_pending', 'bank_deposit_slip_url')) as payment_columns_added;

