# Auditor Schema Verification

## ✅ Database Schema Status

### **Tables Created/Enhanced:**

#### **Job Card Audit Tables** (Reference `audits` table):
1. ✅ `audit_image_verification` - References `audits(id)`
2. ✅ `audit_findings` - References `audits(id)`
3. ✅ `audit_escalations` - References `audits(id)`
4. ✅ `audit_job_card_checklist` - References `audits(id)`
5. ✅ `audit_media_files` - References `audits(id)`

#### **Workshop Facility Audit Tables** (Reference `workshop_audits` table):
1. ✅ `audit_checklist_items` - References `workshop_audits(id)`
2. ✅ `audit_media` - References `workshop_audits(id)`
3. ✅ `audit_action_items` - References `workshop_audits(id)`

#### **Common/Supporting Tables:**
1. ✅ `audit_scoring_weights` - No FK, lookup table
2. ✅ `audit_templates` - No FK
3. ✅ `auditor_performance_metrics` - References `users_login(id)`
4. ✅ `workshop_certifications` - References `workshops(id)`
5. ✅ `workshop_compliance_history` - References `workshops(id)`

### **Enhanced Tables:**

#### **`audits` Table** (Job Card Audits):
- ✅ `audit_mode` (ON_GROUND/DIGITAL)
- ✅ `arrival_latitude`, `arrival_longitude`, `arrival_time` (GPS)
- ✅ `before_images_verified`, `during_images_verified`, `after_images_verified`
- ✅ `images_compliance_score`
- ✅ `extra_charges_validated`, `extra_charges_rejected_count`, `extra_charges_rejection_reasons`
- ✅ `findings`, `issues_severity`, `recommendations`
- ✅ `re_audit_required`, `workshop_manager_meeting_required`
- ✅ `escalated`, `escalation_reason`, `escalated_to`, `escalated_at`
- ✅ `fraud_detected`, `fraud_type`, `fraud_details`
- ✅ `sla_deadline`, `sla_status`

#### **`workshop_audits` Table** (Workshop Facility Audits):
- ✅ `arrival_latitude`, `arrival_longitude`, `arrival_time` (GPS)
- ✅ `audit_mode` (ON_GROUND/DIGITAL)
- ✅ `escalated`, `escalation_reason`
- ✅ All scoring columns (`overall_score`, `score_percentage`, `audit_grade`, category scores)

### **Functions:**

#### **Job Card Audit Functions:**
1. ✅ `calculate_job_card_audit_score(p_audit_id UUID)` - Calculates weighted score for job card audits
2. ✅ `check_audit_sla()` - Updates SLA status for audits
3. ✅ `trigger_calculate_job_card_score()` - Trigger function for auto-calculation

#### **Workshop Audit Functions** (from `10_auditor_enhancements.sql`):
1. ✅ `calculate_audit_score(p_audit_id UUID)` - Calculates overall score for workshop audits
2. ✅ `calculate_category_scores(p_audit_id UUID)` - Calculates category-wise scores
3. ✅ `check_expired_certifications()` - Marks expired certifications
4. ✅ `calculate_auditor_metrics(p_auditor_id UUID, p_date DATE)` - Updates performance metrics

### **Triggers:**

1. ✅ `trigger_update_job_card_score` - On `audits` table updates
2. ✅ `trigger_update_audit_scores` - On `audit_checklist_items` updates (workshop audits)
3. ✅ `trigger_set_audit_duration` - On `workshop_audits` updates
4. ✅ `trigger_mark_overdue_actions` - On `audit_action_items` updates

### **Views:**

1. ✅ `auditor_dashboard` - Simplified view for auditor dashboard
2. ✅ `workshop_compliance_status` - Workshop compliance summary

### **Enums:**

1. ✅ `audit_status` - PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, FOLLOW_UP_REQUIRED
2. ✅ `audit_type` - JOB_CARD, WORKSHOP_FACILITY, SURPRISE, MANDATORY_IMAGE_CHECK
3. ✅ `audit_grade` - A+, A, B, C, D, F (or A_PLUS, A, B, C, D, F)
4. ✅ `verification_status` - PENDING, VERIFIED, REJECTED, NEEDS_CORRECTION, EXPIRED

### **RLS Policies:**

✅ All auditor-related tables have RLS enabled with policies for:
- `AUDITOR` role - Can manage their own audits
- `SUPER_ADMIN` - Can manage all audits
- `SUB_ADMIN` (AUDITOR department) - Can manage department audits

### **Indexes:**

✅ Indexes created on:
- `audits(audit_mode, sla_status, escalated, fraud_detected, lead_id, status)`
- `audit_image_verification(audit_id, image_category)`
- `audit_findings(audit_id, severity)`
- `audit_job_card_checklist(audit_id, category)`
- `workshop_audits(workshop_id, auditor_id, scheduled_date)`
- `audit_checklist_items(audit_id, category)`

## ✅ **VERIFICATION COMPLETE**

All tables, columns, functions, triggers, views, and RLS policies are correctly set up according to the auditor workflow document.

**Migration Files:**
- `74_enhance_auditor_workflow.sql` - Job card audit enhancements
- `10_auditor_enhancements.sql` - Workshop audit enhancements (already exists)
- `75_add_missing_auditor_functions.sql` - Additional functions if needed

**Status:** ✅ **100% Complete**

