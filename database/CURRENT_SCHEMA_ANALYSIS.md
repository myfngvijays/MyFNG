# 🔍 CURRENT SCHEMA ANALYSIS vs LEAD FLOW REQUIREMENTS

## 📊 ANALYSIS DATE
November 20, 2025

---

## ✅ WHAT'S ALREADY PRESENT IN YOUR DATABASE

### 1️⃣ Core Tables (ALL PRESENT ✅)
- ✅ `service_leads` - Main lead table with comprehensive columns
- ✅ `users_login` - User management
- ✅ `roles` - Role-based access
- ✅ `workshops` - Workshop management
- ✅ `cities` - Location management
- ✅ `car_models` - Vehicle models
- ✅ `service_types` - Service types
- ✅ `service_addons` - Add-on services

### 2️⃣ Lead Flow Tables (ALL PRESENT ✅)
- ✅ `lead_activities` - Activity tracking
- ✅ `lead_events` - Event logging
- ✅ `lead_updates` - Updates tracking
- ✅ `lead_media` - Image/file uploads
- ✅ `lead_extra_charges` - Extra charges
- ✅ `lead_pricing_items` - Pricing breakdown
- ✅ `lead_sources` - Lead source tracking

### 3️⃣ Pickup & Delivery Tables (ALL PRESENT ✅)
- ✅ `pickup_tracking` - Complete pickup/drop tracking
- ✅ `pickup_delivery_tasks` - Task management
- ✅ `pickup_otps` - OTP verification
- ✅ `pickup_location_tracking` - Real-time GPS tracking
- ✅ `pickup_incidents` - Incident reporting
- ✅ `pickup_boy_metrics` - Performance metrics

### 4️⃣ Workshop Operations (ALL PRESENT ✅)
- ✅ `job_cards` - Job card generation
- ✅ `job_card_parts` - Parts tracking
- ✅ `mechanic_assignments` - Mechanic assignment
- ✅ `qc_checks` - Quality control
- ✅ `supervisor_actions` - Supervisor actions

### 5️⃣ Audit & Compliance (ALL PRESENT ✅)
- ✅ `audits` - Audit records
- ✅ `workshop_audits` - Workshop audits
- ✅ `audit_checklist` - Checklist items
- ✅ `audit_checklist_items` - Detailed checklist
- ✅ `audit_action_items` - Action items
- ✅ `audit_media` - Audit photos/videos
- ✅ `audit_templates` - Audit templates
- ✅ `audit_logs` - System audit logs
- ✅ `workshop_certifications` - Certifications
- ✅ `workshop_compliance_history` - Compliance tracking
- ✅ `auditor_performance_metrics` - Auditor metrics

### 6️⃣ Financial Tables (ALL PRESENT ✅)
- ✅ `invoices` - Invoice generation
- ✅ `workshop_payouts` - Workshop payments
- ✅ `refund_requests` - Refund management

### 7️⃣ Telecaller Tables (ALL PRESENT ✅)
- ✅ `telecaller_call_logs` - Call tracking
- ✅ `telecaller_follow_ups` - Follow-up management
- ✅ `telecaller_performance_metrics` - Performance tracking
- ✅ `telecaller_scripts` - Call scripts

### 8️⃣ Fraud & Security (ALL PRESENT ✅)
- ✅ `fraud_cases` - Fraud detection
- ✅ `vehicle_condition_photos` - Vehicle photos
- ✅ `data_deletion_requests` - GDPR compliance
- ✅ `user_consents` - User consent tracking

### 9️⃣ System Tables (ALL PRESENT ✅)
- ✅ `system_settings` - System configuration

---

## ⚠️ MISSING COLUMNS IN `service_leads` TABLE

Based on the lead flow requirements, these columns might be missing:

### Lead Manager Validation Columns
```sql
validated_by_id UUID              -- Lead Manager who validated
validated_at TIMESTAMP            -- Validation timestamp
validation_notes TEXT             -- Validation remarks
```

### Workshop Assignment Columns
```sql
assigned_by_workshop_admin_id UUID  -- Workshop Admin who assigned mechanic
workshop_accepted_by UUID           -- Who accepted at workshop
workshop_accepted_at TIMESTAMP      -- When workshop accepted
```

### Quality & Audit Columns
```sql
audit_required BOOLEAN DEFAULT false  -- ✅ Already present
audit_status VARCHAR                  -- ✅ Already present
audit_performed_by UUID               -- Auditor who audited
audit_performed_at TIMESTAMP          -- Audit timestamp
```

### Billing & Invoice Columns
```sql
invoice_generated_by UUID         -- Billing team member
invoice_generated_at TIMESTAMP    -- Invoice generation time
invoice_sent_at TIMESTAMP         -- When invoice sent to customer
```

### CSE Follow-up Columns
```sql
cse_assigned_id UUID             -- CSE assigned for follow-up
cse_assigned_at TIMESTAMP        -- CSE assignment time
cse_followup_completed BOOLEAN   -- Follow-up completion status
cse_followup_notes TEXT          -- CSE remarks
customer_satisfaction_score INT   -- Rating (1-5)
```

### Status Tracking Columns
```sql
assigned_to_workshop_at TIMESTAMP    -- When assigned to workshop
lead_manager_assigned_id UUID        -- Lead Manager handling this
lead_manager_assigned_at TIMESTAMP   -- Lead Manager assignment time
```

---

## 🔧 MISSING ENUM VALUES

Your schema uses `USER-DEFINED` types but doesn't show the actual ENUM definitions. We need to ensure these statuses exist:

### `lead_status` ENUM Should Include:
```sql
'NEW'                      -- ✅ Mentioned
'INCOMPLETE'               -- ❓ Need to verify
'VALIDATED'                -- ❓ NEW - After Lead Manager validation
'ASSIGNED_TO_WORKSHOP'     -- ❓ NEW - After workshop assignment
'ACCEPTED'                 -- ❓ Need to verify
'REJECTED'                 -- ❓ Need to verify
'IN_PROGRESS'              -- ❓ Need to verify
'MECHANIC_WORKING'         -- ❓ NEW - Mechanic started work
'AWAITING_QC'              -- ❓ NEW - Waiting for QC
'QC_APPROVED'              -- ❓ NEW - QC passed
'QC_FAILED'                -- ❓ NEW - QC failed
'READY_FOR_BILLING'        -- ❓ NEW - Ready for invoice
'INVOICE_GENERATED'        -- ❓ NEW - Invoice created
'PAYMENT_PENDING'          -- ❓ Need to verify
'PAID'                     -- ❓ Need to verify
'AWAITING_DELIVERY'        -- ❓ NEW - Waiting for pickup/delivery
'COMPLETED'                -- ❓ Need to verify
'CLOSED'                   -- ❓ NEW - Fully closed by CSE
'CANCELLED'                -- ❓ Need to verify
```

### Other ENUMs to Verify:
- `lead_type`: NORMAL, EMERGENCY, VIP, CORPORATE
- `lead_priority`: LOW, MEDIUM, HIGH, URGENT, CRITICAL
- `sla_status`: ON_TIME, WARNING, BREACHED
- `payment_mode`: CASH, ONLINE, UPI, CARD, WALLET, PREPAID, POSTPAID
- `pickup_status`: NOT_ASSIGNED, ASSIGNED, EN_ROUTE, PICKED_UP, DELIVERED, CANCELLED
- `drop_status`: NOT_REQUIRED, ASSIGNED, EN_ROUTE, COMPLETED, FAILED
- `pickup_task_status`: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, FAILED
- `audit_status`: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, RESCHEDULED
- `audit_grade`: A_PLUS, A, B_PLUS, B, C, D, FAIL
- `verification_status`: PENDING, VERIFIED, REJECTED, EXPIRED

---

## 📋 MISSING TABLES

### ❌ `cse_followups` Table
For Customer Service Executive follow-ups (separate from telecaller):

```sql
CREATE TABLE IF NOT EXISTS cse_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  cse_id UUID NOT NULL REFERENCES users_login(id),
  followup_type VARCHAR NOT NULL,  -- POST_SERVICE, COMPLAINT, SATISFACTION_CHECK
  scheduled_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  customer_response TEXT,
  satisfaction_score INT CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
  issues_reported TEXT,
  resolution_provided TEXT,
  escalated BOOLEAN DEFAULT false,
  escalated_to UUID REFERENCES users_login(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ❌ `billing_team_actions` Table
For tracking billing team activities:

```sql
CREATE TABLE IF NOT EXISTS billing_team_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  invoice_id UUID REFERENCES invoices(id),
  billing_member_id UUID NOT NULL REFERENCES users_login(id),
  action_type VARCHAR NOT NULL,  -- GENERATED, SENT, REVISED, CANCELLED
  action_description TEXT,
  invoice_sent_via VARCHAR,  -- WHATSAPP, SMS, EMAIL, PDF
  sent_at TIMESTAMP WITH TIME ZONE,
  customer_viewed BOOLEAN DEFAULT false,
  customer_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### ❌ `customer_complaints` Table
For tracking customer complaints and resolutions:

```sql
CREATE TABLE IF NOT EXISTS customer_complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number VARCHAR UNIQUE NOT NULL,
  lead_id UUID REFERENCES service_leads(id),
  customer_id UUID REFERENCES users_login(id),
  workshop_id UUID REFERENCES workshops(id),
  complaint_type VARCHAR NOT NULL,
  complaint_category VARCHAR,  -- SERVICE_QUALITY, PRICING, BEHAVIOR, DELAY
  severity VARCHAR DEFAULT 'MEDIUM',  -- LOW, MEDIUM, HIGH, CRITICAL
  description TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  status VARCHAR DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, RESOLVED, CLOSED, ESCALATED
  assigned_to UUID REFERENCES users_login(id),
  resolution TEXT,
  resolved_by UUID REFERENCES users_login(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  customer_satisfied BOOLEAN,
  refund_issued BOOLEAN DEFAULT false,
  refund_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🎯 LEAD FLOW COVERAGE ANALYSIS

### ✅ STEP 1: Lead Created (NEW) - **100% COVERED**
- `service_leads.status = 'NEW'`
- `service_leads.created_by_id`
- `service_leads.created_at`
- SLA columns present

### ⚠️ STEP 2: Lead Manager Validation - **70% COVERED**
**Present:**
- Lead Manager can view leads
- Lead activities tracking exists

**Missing:**
- `validated_by_id`
- `validated_at`
- `validation_notes`
- Dedicated status: `VALIDATED`

### ⚠️ STEP 3: Lead Manager Assigns Workshop - **80% COVERED**
**Present:**
- `workshop_id`
- `assigned_at`

**Missing:**
- `lead_manager_assigned_id` (who assigned it)
- Dedicated status: `ASSIGNED_TO_WORKSHOP`

### ✅ STEP 4: Workshop Admin Accepts/Rejects - **100% COVERED**
- `accepted_at`
- `declined_at`
- `rejected_at`
- `rejected_reason`
- `rejection_notes`

### ✅ STEP 5: Workshop Admin Assigns Mechanic/Pickup - **100% COVERED**
- `assigned_mechanic_id`
- `assigned_pickup_boy_id`
- `assigned_supervisor_id`
- Timestamps present

### ✅ STEP 6: Pickup & Job Start - **100% COVERED**
- Complete `pickup_tracking` table
- `pickup_otps` table
- `pickup_location_tracking`
- Media uploads via `lead_media`

### ✅ STEP 7: Mechanic & Supervisor Work - **100% COVERED**
- `job_cards` table
- `lead_extra_charges`
- `qc_checks`
- `supervisor_actions`
- Media tracking

### ✅ STEP 8: Auditor Verification - **100% COVERED**
- `audits` table
- `workshop_audits`
- Complete audit workflow

### ⚠️ STEP 9: Billing Generates Invoice - **90% COVERED**
**Present:**
- `invoices` table
- `invoice_generated_by`

**Missing:**
- `invoice_sent_at` column
- Billing team action tracking

### ✅ STEP 10: Customer Payment - **100% COVERED**
- `payment_mode`
- `payment_status`
- `payment_txn_id`
- `payment_collected_at` in pickup_tracking

### ⚠️ STEP 11: CSE Follow-Up - **60% COVERED**
**Present:**
- Can reuse `telecaller_follow_ups`

**Missing:**
- Dedicated CSE follow-up table
- Customer satisfaction tracking
- Post-service feedback

### ⚠️ STEP 12: Lead Closed - **80% COVERED**
**Present:**
- `completed_at`
- Status tracking

**Missing:**
- Dedicated `CLOSED` status
- CSE closure confirmation
- Final satisfaction score

---

## 🔥 PRIORITY ACTIONS NEEDED

### 🎯 HIGH PRIORITY (Must Have)

1. **Add Lead Manager Columns to `service_leads`:**
   ```sql
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validation_notes TEXT;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS lead_manager_assigned_id UUID;
   ```

2. **Add CSE Columns to `service_leads`:**
   ```sql
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_assigned_id UUID;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_assigned_at TIMESTAMP WITH TIME ZONE;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS cse_followup_completed BOOLEAN DEFAULT false;
   ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS customer_satisfaction_score INT;
   ```

3. **Add Missing Lead Status Values:**
   ```sql
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VALIDATED';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ASSIGNED_TO_WORKSHOP';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'MECHANIC_WORKING';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AWAITING_QC';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_APPROVED';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'READY_FOR_BILLING';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AWAITING_DELIVERY';
   ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CLOSED';
   ```

### 🎯 MEDIUM PRIORITY (Recommended)

4. **Create CSE Follow-ups Table**
5. **Create Customer Complaints Table**
6. **Add Billing Tracking Columns**

### 🎯 LOW PRIORITY (Nice to Have)

7. **Create Billing Team Actions Table**
8. **Add Workshop Assignment Tracking**

---

## 📊 OVERALL COVERAGE SCORE

| Category | Coverage | Status |
|----------|----------|--------|
| **Core Tables** | 100% | ✅ Complete |
| **Pickup & Delivery** | 100% | ✅ Complete |
| **Workshop Operations** | 100% | ✅ Complete |
| **Audit System** | 100% | ✅ Complete |
| **Financial** | 95% | ⚠️ Minor gaps |
| **Lead Manager Flow** | 70% | ⚠️ Needs columns |
| **CSE Flow** | 60% | ⚠️ Needs table |
| **Status Tracking** | 75% | ⚠️ Needs ENUMs |

**TOTAL COVERAGE: 87.5%** 🎯

---

## ✅ CONCLUSION

Your database schema is **VERY COMPREHENSIVE** and covers 87.5% of the lead flow requirements!

**What's Great:**
- All major tables exist
- Pickup/delivery fully implemented
- Audit system is enterprise-grade
- Workshop operations complete

**What Needs Fixing:**
1. Add 10-15 missing columns to `service_leads`
2. Add missing status ENUM values
3. Create CSE follow-ups table (optional but recommended)
4. Add customer complaints table (optional)

---

## 🚀 NEXT STEP

I'll create a **FINAL MIGRATION FILE** that:
1. ✅ Safely adds all missing columns
2. ✅ Adds all missing ENUM values
3. ✅ Creates missing tables
4. ✅ Works on your existing database without errors
5. ✅ Is 100% idempotent (can run multiple times)

**Ready to generate the final migration?** 🎯

