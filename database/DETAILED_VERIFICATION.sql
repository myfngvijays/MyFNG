-- ================================================================
-- 🔍 DETAILED VERIFICATION - Check exactly what exists
-- ================================================================

-- ================================================================
-- 1️⃣ CHECK ALL NEW COLUMNS (One by One)
-- ================================================================

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'validated_by_id') 
        THEN '✅ validated_by_id' 
        ELSE '❌ validated_by_id MISSING' 
    END as status
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'validated_at') THEN '✅ validated_at' ELSE '❌ validated_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'validation_notes') THEN '✅ validation_notes' ELSE '❌ validation_notes MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'lead_manager_assigned_id') THEN '✅ lead_manager_assigned_id' ELSE '❌ lead_manager_assigned_id MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'lead_manager_assigned_at') THEN '✅ lead_manager_assigned_at' ELSE '❌ lead_manager_assigned_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'assigned_to_workshop_at') THEN '✅ assigned_to_workshop_at' ELSE '❌ assigned_to_workshop_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'workshop_accepted_by') THEN '✅ workshop_accepted_by' ELSE '❌ workshop_accepted_by MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'assigned_by_workshop_admin_id') THEN '✅ assigned_by_workshop_admin_id' ELSE '❌ assigned_by_workshop_admin_id MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'audit_performed_by') THEN '✅ audit_performed_by' ELSE '❌ audit_performed_by MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'audit_performed_at') THEN '✅ audit_performed_at' ELSE '❌ audit_performed_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'invoice_generated_by') THEN '✅ invoice_generated_by' ELSE '❌ invoice_generated_by MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'invoice_generated_at') THEN '✅ invoice_generated_at' ELSE '❌ invoice_generated_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'invoice_sent_at') THEN '✅ invoice_sent_at' ELSE '❌ invoice_sent_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'cse_assigned_id') THEN '✅ cse_assigned_id' ELSE '❌ cse_assigned_id MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'cse_assigned_at') THEN '✅ cse_assigned_at' ELSE '❌ cse_assigned_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'cse_followup_completed') THEN '✅ cse_followup_completed' ELSE '❌ cse_followup_completed MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'cse_followup_notes') THEN '✅ cse_followup_notes' ELSE '❌ cse_followup_notes MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'customer_satisfaction_score') THEN '✅ customer_satisfaction_score' ELSE '❌ customer_satisfaction_score MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'final_closure_at') THEN '✅ final_closure_at' ELSE '❌ final_closure_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'closed_by') THEN '✅ closed_by' ELSE '❌ closed_by MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'mechanic_started_at') THEN '✅ mechanic_started_at' ELSE '❌ mechanic_started_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'mechanic_completed_at') THEN '✅ mechanic_completed_at' ELSE '❌ mechanic_completed_at MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'payment_collected_by') THEN '✅ payment_collected_by' ELSE '❌ payment_collected_by MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_leads' AND column_name = 'payment_collected_at') THEN '✅ payment_collected_at' ELSE '❌ payment_collected_at MISSING' END;

-- ================================================================
-- 2️⃣ CHECK ALL NEW STATUS VALUES (One by One)
-- ================================================================

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VALIDATED' AND enumtypid = 'lead_status'::regtype) 
        THEN '✅ VALIDATED status exists' 
        ELSE '❌ VALIDATED status MISSING' 
    END as status
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ASSIGNED_TO_WORKSHOP' AND enumtypid = 'lead_status'::regtype) THEN '✅ ASSIGNED_TO_WORKSHOP exists' ELSE '❌ ASSIGNED_TO_WORKSHOP MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MECHANIC_WORKING' AND enumtypid = 'lead_status'::regtype) THEN '✅ MECHANIC_WORKING exists' ELSE '❌ MECHANIC_WORKING MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_QC' AND enumtypid = 'lead_status'::regtype) THEN '✅ AWAITING_QC exists' ELSE '❌ AWAITING_QC MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_APPROVED' AND enumtypid = 'lead_status'::regtype) THEN '✅ QC_APPROVED exists' ELSE '❌ QC_APPROVED MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'QC_FAILED' AND enumtypid = 'lead_status'::regtype) THEN '✅ QC_FAILED exists' ELSE '❌ QC_FAILED MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'READY_FOR_BILLING' AND enumtypid = 'lead_status'::regtype) THEN '✅ READY_FOR_BILLING exists' ELSE '❌ READY_FOR_BILLING MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INVOICE_GENERATED' AND enumtypid = 'lead_status'::regtype) THEN '✅ INVOICE_GENERATED exists' ELSE '❌ INVOICE_GENERATED MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'AWAITING_DELIVERY' AND enumtypid = 'lead_status'::regtype) THEN '✅ AWAITING_DELIVERY exists' ELSE '❌ AWAITING_DELIVERY MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLOSED' AND enumtypid = 'lead_status'::regtype) THEN '✅ CLOSED exists' ELSE '❌ CLOSED MISSING' END;

-- ================================================================
-- 3️⃣ CHECK ALL NEW TABLES
-- ================================================================

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cse_followups') 
        THEN '✅ cse_followups table exists' 
        ELSE '❌ cse_followups table MISSING' 
    END as status
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_complaints') THEN '✅ customer_complaints table exists' ELSE '❌ customer_complaints table MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_team_actions') THEN '✅ billing_team_actions table exists' ELSE '❌ billing_team_actions table MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cse_performance_metrics') THEN '✅ cse_performance_metrics table exists' ELSE '❌ cse_performance_metrics table MISSING' END
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lead_status_history') THEN '✅ lead_status_history table exists' ELSE '❌ lead_status_history table MISSING' END;

-- ================================================================
-- 4️⃣ CHECK lead_flow_dashboard VIEW
-- ================================================================

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'lead_flow_dashboard') 
        THEN '✅ lead_flow_dashboard view exists' 
        ELSE '❌ lead_flow_dashboard view MISSING' 
    END as status;

-- ================================================================
-- 5️⃣ LIST ALL CURRENT LEAD STATUSES
-- ================================================================

SELECT 
    '📊 Current Lead Statuses:' as info,
    enumlabel as status_value
FROM pg_enum 
WHERE enumtypid = 'lead_status'::regtype
ORDER BY enumsortorder;

