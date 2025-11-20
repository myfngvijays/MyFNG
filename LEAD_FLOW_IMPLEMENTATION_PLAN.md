# 🚀 Lead Flow Implementation Plan

## Current vs Required - Gap Analysis

---

## 📊 Current Implementation Status

### Current Status Values (Limited):
```sql
CREATE TYPE lead_status AS ENUM (
  'NEW',
  'ASSIGNED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);
```

**Total:** 7 statuses only ❌

### Required Status Values (Complete Flow):
```sql
CREATE TYPE lead_status AS ENUM (
  'NEW',              -- ✅ EXISTS
  'INCOMPLETE',       -- ❌ MISSING
  'VALIDATED',        -- ❌ MISSING
  'ASSIGNED',         -- ✅ EXISTS (but need ASSIGNED_TO_WORKSHOP)
  'PENDING_ACCEPTANCE', -- ❌ MISSING
  'ACCEPTED',         -- ✅ EXISTS
  'REJECTED',         -- ✅ EXISTS
  'TEAM_ASSIGNED',    -- ❌ MISSING
  'PICKUP_SCHEDULED', -- ❌ MISSING
  'IN_TRANSIT',       -- ❌ MISSING
  'DELIVERED',        -- ❌ MISSING
  'IN_PROGRESS',      -- ✅ EXISTS
  'WORK_COMPLETED',   -- ❌ MISSING
  'QC_PENDING',       -- ❌ MISSING
  'QC_APPROVED',      -- ❌ MISSING
  'AUDIT_PENDING',    -- ❌ MISSING
  'AUDIT_APPROVED',   -- ❌ MISSING
  'INVOICE_GENERATED',-- ❌ MISSING
  'AWAITING_PAYMENT', -- ❌ MISSING
  'PAYMENT_COMPLETED',-- ❌ MISSING
  'COMPLETED',        -- ✅ EXISTS
  'CLOSED',           -- ❌ MISSING
  'CANCELLED',        -- ✅ EXISTS
  'ESCALATED'         -- ❌ MISSING
);
```

**Gap:** 18 NEW statuses needed! 🎯

---

## 📋 Implementation Phases

### 🟦 PHASE 1 - Database Schema Updates (Priority: HIGH)

#### 1.1 Update lead_status ENUM
**File:** `database/migrations/update_lead_status_enum.sql`

```sql
-- Add all missing status values
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'INCOMPLETE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ASSIGNED_TO_WORKSHOP';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PENDING_ACCEPTANCE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'TEAM_ASSIGNED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PICKUP_SCHEDULED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'WORK_COMPLETED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_PENDING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'QC_APPROVED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AUDIT_PENDING';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AUDIT_APPROVED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PAYMENT_COMPLETED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ESCALATED';
```

#### 1.2 Add Missing Columns to service_leads
**Check if exists:**
- ✅ `assigned_mechanic_id`
- ✅ `assigned_supervisor_id`
- ✅ `assigned_pickup_boy_id` (or `assigned_pickup_id`)
- ❓ `validated_by_id` (Lead Manager who validated)
- ❓ `validated_at`
- ❓ `qc_performed_by` (Supervisor)
- ❓ `qc_performed_at`
- ❓ `qc_status` (PENDING/APPROVED/REJECTED)
- ❓ `audit_required` (Boolean)
- ❓ `audit_status`
- ❓ `audit_performed_by`
- ❓ `audit_performed_at`
- ❓ `invoice_id` (FK to invoices table)
- ❓ `invoice_amount`
- ❓ `closed_by_id` (CSE who closed)
- ❓ `closed_at`

**Migration:**
```sql
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_by_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_by_id UUID REFERENCES users_login(id);
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
-- (Add all missing columns)
```

#### 1.3 Create invoices Table (if not exists)
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR UNIQUE NOT NULL,
  lead_id UUID REFERENCES service_leads(id),
  workshop_id UUID REFERENCES workshops(id),
  base_amount DECIMAL(10,2),
  extra_charges DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR DEFAULT 'GENERATED',
  payment_mode VARCHAR,
  payment_txn_id VARCHAR,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.4 Create lead_status_history Table (if not exists)
**For tracking all status changes:**
```sql
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES service_leads(id),
  old_status lead_status,
  new_status lead_status NOT NULL,
  changed_by_id UUID REFERENCES users_login(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  notes TEXT
);
```

---

### 🟧 PHASE 2 - Backend Services (Priority: HIGH)

#### 2.1 Update leadStatusService.ts
**File:** `apps/web/src/lib/services/leadStatusService.ts`

**Add:**
- New status transition rules
- Role-based permissions for each status
- Status validation logic
- Auto-status progression triggers

**Example:**
```typescript
const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['INCOMPLETE', 'VALIDATED', 'CANCELLED'],
  INCOMPLETE: ['VALIDATED', 'CANCELLED'],
  VALIDATED: ['ASSIGNED_TO_WORKSHOP', 'CANCELLED'],
  ASSIGNED_TO_WORKSHOP: ['PENDING_ACCEPTANCE', 'CANCELLED'],
  PENDING_ACCEPTANCE: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['TEAM_ASSIGNED', 'CANCELLED'],
  TEAM_ASSIGNED: ['PICKUP_SCHEDULED', 'IN_PROGRESS'], // If no pickup
  PICKUP_SCHEDULED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['IN_PROGRESS'],
  IN_PROGRESS: ['WORK_COMPLETED', 'CANCELLED'],
  WORK_COMPLETED: ['QC_PENDING'],
  QC_PENDING: ['QC_APPROVED', 'IN_PROGRESS'], // If QC fails
  QC_APPROVED: ['AUDIT_PENDING', 'INVOICE_GENERATED'], // If audit not needed
  AUDIT_PENDING: ['AUDIT_APPROVED', 'ESCALATED'],
  AUDIT_APPROVED: ['INVOICE_GENERATED'],
  INVOICE_GENERATED: ['AWAITING_PAYMENT'],
  AWAITING_PAYMENT: ['PAYMENT_COMPLETED', 'CANCELLED'],
  PAYMENT_COMPLETED: ['COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [], // Terminal
  CANCELLED: [], // Terminal
  REJECTED: ['VALIDATED'], // Back to Lead Manager
  ESCALATED: ['QC_APPROVED', 'CLOSED']
};
```

#### 2.2 Create API Endpoints

**New API Routes Needed:**

1. **Lead Manager APIs:**
   - `POST /api/lead-manager/leads/:id/validate` - Validate lead
   - `POST /api/lead-manager/leads/:id/assign-workshop` - Assign workshop
   - `POST /api/lead-manager/leads/:id/mark-fraud` - Mark as fraud
   - `GET /api/lead-manager/dashboard/stats` - Dashboard stats

2. **Workshop Admin APIs:**
   - `POST /api/workshop/leads/:id/accept` - Accept lead
   - `POST /api/workshop/leads/:id/reject` - Reject with reason
   - `POST /api/workshop/leads/:id/assign-team` - Assign mechanic/supervisor/pickup

3. **Mechanic APIs:**
   - `POST /api/mechanic/jobs/:id/start` - Start job
   - `POST /api/mechanic/jobs/:id/request-extra-work` - Request extra charges
   - `POST /api/mechanic/jobs/:id/complete` - Mark complete

4. **Supervisor APIs:**
   - `POST /api/supervisor/jobs/:id/approve-qc` - Approve QC
   - `POST /api/supervisor/jobs/:id/reject-qc` - Reject QC
   - `POST /api/supervisor/jobs/:id/approve-extra-work` - Approve extra charges

5. **Pickup Boy APIs:**
   - `POST /api/pickup/tasks/:id/start` - Start pickup
   - `POST /api/pickup/tasks/:id/verify-otp` - Verify OTP
   - `POST /api/pickup/tasks/:id/complete` - Mark delivered

6. **Billing APIs:**
   - `POST /api/billing/leads/:id/generate-invoice` - Generate invoice
   - `GET /api/billing/invoices/:id` - Get invoice

7. **Payment APIs:**
   - `POST /api/payment/invoices/:id/process` - Process payment
   - `POST /api/payment/webhook` - Payment gateway webhook

8. **CSE APIs:**
   - `POST /api/cse/leads/:id/follow-up` - Log follow-up call
   - `POST /api/cse/leads/:id/close` - Close lead

9. **Auditor APIs:**
   - `POST /api/audit/leads/:id/approve` - Approve audit
   - `POST /api/audit/leads/:id/flag` - Flag issue

---

### 🟩 PHASE 3 - Frontend Dashboards (Priority: MEDIUM)

#### 3.1 Lead Manager Dashboard Updates
**File:** `apps/web/src/app/dashboard/lead_manager/page.tsx`

**Add Sections:**
- 🔍 Validation Queue (NEW leads)
- ⚠️ Incomplete Leads
- 📍 Assignment Panel (assign workshop)
- 🔄 Rejected Leads (from workshops)
- 📊 SLA Monitoring
- 🚨 Fraud/Spam Management

**New Pages:**
- `/dashboard/lead_manager/leads/:id/validate` - Lead validation page
- `/dashboard/lead_manager/assign-workshop` - Workshop assignment page
- `/dashboard/lead_manager/fraud` - Fraud management

#### 3.2 Workshop Admin Dashboard Updates
**File:** `apps/web/src/app/dashboard/workshop_admin/page.tsx`

**Add Sections:**
- 📬 Pending Acceptance (ASSIGNED_TO_WORKSHOP status)
- ✅ Accept/Reject Buttons
- 👥 Team Assignment Panel
- 📊 Active Jobs Overview

**New Pages:**
- `/dashboard/workshop_admin/leads/:id/accept` - Accept/Reject page
- `/dashboard/workshop_admin/leads/:id/assign-team` - Team assignment

#### 3.3 Mechanic Dashboard Updates
**File:** `apps/web/src/app/dashboard/workshop_mechanic/page.tsx`

**Add:**
- 🔧 Job Detail View
- ▶️ Start Job Button
- 💰 Request Extra Work Form
- ✅ Complete Job Button
- 📸 Image Upload (before/during/after)

#### 3.4 Supervisor Dashboard Updates
**File:** `apps/web/src/app/dashboard/workshop_supervisor/page.tsx`

**Add:**
- 🔍 QC Queue (WORK_COMPLETED jobs)
- ✅ Approve QC
- ❌ Reject QC (back to mechanic)
- 💰 Extra Work Approval

#### 3.5 Pickup Boy Dashboard Updates
**File:** `apps/web/src/app/dashboard/pickup_boy/page.tsx`

**Add:**
- 📍 Task List (with GPS)
- 🔐 OTP Verification
- 📸 Before Images Upload
- ✅ Mark Delivered

#### 3.6 Billing Dashboard (New)
**File:** `apps/web/src/app/dashboard/billing/page.tsx`

**Create:**
- 📄 Invoice Generation Queue
- 📊 Revenue Analytics
- 💰 Payment Status Tracking

#### 3.7 CSE Dashboard (New)
**File:** `apps/web/src/app/dashboard/cse/page.tsx`

**Create:**
- 📞 Follow-up Queue
- ⭐ Customer Feedback Collection
- ✅ Close Lead

#### 3.8 Auditor Dashboard (New)
**File:** `apps/web/src/app/dashboard/auditor/page.tsx`

**Create:**
- 🔍 Audit Queue
- ✅ Approve Audit
- 🚨 Flag Issues

---

### 🟥 PHASE 4 - Notifications & Webhooks (Priority: MEDIUM)

#### 4.1 Real-time Notifications
**Setup:**
- Supabase Realtime for instant updates
- Browser notifications
- In-app notification center

**Events to Track:**
- Lead assigned
- Lead accepted/rejected
- Job started
- QC pending
- Payment received
- Status changed

#### 4.2 SMS/WhatsApp Notifications
**Integrate:**
- Twilio / MSG91 for SMS
- WhatsApp Business API
- Send customer updates:
  - Lead accepted
  - Pickup scheduled
  - Job started
  - Job completed
  - Invoice generated
  - Payment received

#### 4.3 Email Notifications
**Setup:**
- Resend / SendGrid
- Templates for:
  - Invoice PDF
  - Receipt
  - Service report
  - Follow-up emails

---

### 🟦 PHASE 5 - Analytics & Reporting (Priority: LOW)

#### 5.1 Dashboard Analytics
**Add:**
- Lead conversion funnel
- SLA adherence reports
- Workshop performance scores
- Revenue analytics
- Customer satisfaction scores

#### 5.2 Create Views for Analytics
```sql
CREATE VIEW lead_analytics AS
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_hours
FROM service_leads
GROUP BY status;
```

---

## 📝 Implementation Order (Recommended)

### Week 1: Foundation
1. ✅ Update database schema (ENUM + columns)
2. ✅ Create new tables (invoices, status_history)
3. ✅ Update leadStatusService.ts
4. ✅ Test status transitions

### Week 2: Core APIs
1. ✅ Lead Manager APIs
2. ✅ Workshop Admin APIs
3. ✅ Mechanic APIs
4. ✅ Pickup Boy APIs
5. ✅ Test API endpoints

### Week 3: Frontend - Part 1
1. ✅ Update Lead Manager dashboard
2. ✅ Update Workshop Admin dashboard
3. ✅ Update Mechanic dashboard
4. ✅ Test workflows

### Week 4: Frontend - Part 2
1. ✅ Update Supervisor dashboard
2. ✅ Update Pickup Boy dashboard
3. ✅ Create Billing dashboard
4. ✅ Create CSE dashboard
5. ✅ Test end-to-end flow

### Week 5: Notifications & Polish
1. ✅ Setup notifications
2. ✅ SMS/WhatsApp integration
3. ✅ Email templates
4. ✅ Analytics dashboards
5. ✅ Final testing

---

## 🎯 Quick Start (MVP Version)

### If you want to start NOW with basic flow:

**Minimal Implementation:**
1. Add 5 key statuses:
   - `VALIDATED`
   - `ASSIGNED_TO_WORKSHOP`
   - `TEAM_ASSIGNED`
   - `QC_PENDING`
   - `CLOSED`

2. Create 3 critical APIs:
   - Lead Manager: Validate & Assign Workshop
   - Workshop Admin: Accept/Reject & Assign Team
   - Supervisor: QC Approval

3. Update 2 dashboards:
   - Lead Manager: Add validation + assignment panel
   - Workshop Admin: Add accept/reject buttons

**Time:** 2-3 days for MVP ⚡

---

## 🚀 Next Steps

**Choose your path:**

### Option A: Full Implementation (Recommended)
- Complete all phases
- Production-ready system
- Time: 4-5 weeks

### Option B: MVP First (Quick Win)
- Basic flow with 5 new statuses
- Core APIs only
- Time: 2-3 days
- Then iterate

### Option C: Phased Rollout
- Phase 1 (Week 1): Lead Manager flow
- Phase 2 (Week 2): Workshop flow
- Phase 3 (Week 3): Mechanic/Supervisor
- Phase 4 (Week 4): Billing/CSE
- Phase 5 (Week 5): Polish

**Recommend Option B (MVP) → then Option C (Phased)**

---

## ❓ Questions to Clarify

1. **Priority:** Full implementation or MVP first?
2. **Timeline:** Urgent or can take 4-5 weeks?
3. **Payment Gateway:** Which provider? (Razorpay/Stripe/PhonePe)
4. **SMS Provider:** Twilio or MSG91?
5. **Current Blockers:** Any existing bugs to fix first?
6. **Testing:** Manual testing or automated tests needed?

---

**Status:** 📋 Implementation Plan Ready  
**Next:** Awaiting your decision on approach  
**Date:** November 20, 2025

