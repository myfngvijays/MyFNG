# 📋 13-STEP INVOICE & PAYMENT FLOW - COMPLETE IMPLEMENTATION PLAN

**Date:** November 26, 2025  
**Status:** Planning Phase  
**Goal:** Complete end-to-end invoice and payment flow from WORK_COMPLETE to ARCHIVED

---

## 🎯 OVERVIEW

This document outlines the complete implementation plan for the 13-step invoice and payment flow, covering:
- Invoice Review & Approval
- Invoice Sharing
- Payment Collection (Multiple Methods)
- Receipt Generation
- Vehicle Delivery
- CSE Follow-up
- Accounts Reconciliation
- Workshop Payouts
- Refunds & Disputes
- Archival
- Reporting & KPIs
- Notifications & Audit Trail

---

## 📊 CURRENT STATE ANALYSIS

### ✅ What's Already Implemented

1. **Basic Invoice Generation** ✅
   - API: `/api/billing/leads/[id]/generate-invoice`
   - Database: `invoices` table with all required fields
   - Tax calculation (CGST/SGST/IGST)
   - Line items with HSN/SAC codes
   - Status: `INVOICE_GENERATED` → `AWAITING_PAYMENT`

2. **Invoice Review & Approval** ✅ (Partial)
   - API: `/api/billing/invoices/[id]/approve`
   - API: `/api/billing/invoices/[id]/reject`
   - Database: `invoice_reviews` table
   - Status: `GENERATED` → `APPROVED`

3. **Invoice Sharing** ✅ (Partial)
   - API: `/api/billing/invoices/[id]/send`
   - Email & SMS support
   - WhatsApp placeholder
   - Database: `invoice_sharing_logs` table

4. **Payment Collection** ✅ (Partial)
   - Razorpay integration
   - API: `/api/payments/create-order`
   - API: `/api/payments/verify`
   - API: `/api/payments/webhook`
   - Database: `payment_transactions` table
   - Status: `AWAITING_PAYMENT` → `PAID`

5. **Receipt Generation** ⚠️ (Basic)
   - PDF generation service exists
   - Email template exists
   - Needs enhancement

6. **Vehicle Delivery** ✅
   - Delivery OTP verification
   - Delivery images upload
   - Status: `PAID` → `READY_FOR_DELIVERY` → `DELIVERED`

7. **CSE Follow-up** ✅ (Partial)
   - API: `/api/cse/leads/[id]/follow-up`
   - Database: `cse_followups` table
   - Rating collection
   - Needs enhancement

8. **Workshop Payouts** ⚠️ (Database Only)
   - Database: `workshop_payouts` table exists
   - APIs: Basic payout calculation exists
   - Needs: Full automation, approval workflow, bank integration

9. **Refunds** ⚠️ (Database Only)
   - Database: `refund_requests` table exists
   - Needs: Full workflow, approval, processing

10. **Reconciliation** ❌ (Not Implemented)
    - No reconciliation system
    - No GL posting
    - No exception handling

11. **Archival** ❌ (Not Implemented)
    - No archival system
    - No record locking
    - No immutable storage

12. **Reporting & KPIs** ⚠️ (Partial)
    - Basic analytics exist
    - Needs: Complete KPI tracking, SLA monitoring

13. **Notifications & Audit Trail** ⚠️ (Partial)
    - Basic event logging exists
    - Needs: Complete event bus, finance_events, lead_events

---

## 🗄️ DATABASE SCHEMA GAPS

### Missing Tables

1. **finance_events** ❌
   ```sql
   CREATE TABLE finance_events (
     id UUID PRIMARY KEY,
     event_type VARCHAR(50), -- invoice_created, invoice_approved, payment_received, etc.
     entity_type VARCHAR(50), -- invoice, payment, payout, refund
     entity_id UUID,
     actor_id UUID,
     actor_role VARCHAR(50),
     event_data JSONB,
     ip_address VARCHAR(50),
     user_agent TEXT,
     created_at TIMESTAMP
   );
   ```

2. **payout_items** ❌
   ```sql
   CREATE TABLE payout_items (
     id UUID PRIMARY KEY,
     payout_id UUID REFERENCES workshop_payouts(id),
     lead_id UUID REFERENCES service_leads(id),
     invoice_id UUID REFERENCES invoices(id),
     amount DECIMAL(10,2),
     commission_percentage DECIMAL(5,2),
     commission_amount DECIMAL(10,2),
     net_amount DECIMAL(10,2),
     created_at TIMESTAMP
   );
   ```

3. **recon_exceptions** ❌
   ```sql
   CREATE TABLE recon_exceptions (
     id UUID PRIMARY KEY,
     payment_id UUID REFERENCES payment_transactions(id),
     exception_type VARCHAR(50), -- UNMATCHED, AMOUNT_MISMATCH, DUPLICATE, FAILED
     exception_data JSONB,
     status VARCHAR(50), -- PENDING, RESOLVED, ESCALATED
     resolved_by UUID,
     resolved_at TIMESTAMP,
     created_at TIMESTAMP
   );
   ```

4. **gl_entries** ❌ (General Ledger)
   ```sql
   CREATE TABLE gl_entries (
     id UUID PRIMARY KEY,
     entry_type VARCHAR(50), -- DEBIT, CREDIT
     account_type VARCHAR(50), -- REVENUE, TAX, BANK, CASH
     amount DECIMAL(10,2),
     reference_type VARCHAR(50), -- invoice, payment, payout
     reference_id UUID,
     description TEXT,
     posted_at TIMESTAMP,
     posted_by UUID,
     created_at TIMESTAMP
   );
   ```

5. **settlement_reports** ❌
   ```sql
   CREATE TABLE settlement_reports (
     id UUID PRIMARY KEY,
     report_date DATE,
     report_type VARCHAR(50), -- DAILY, WEEKLY, MONTHLY
     provider VARCHAR(50), -- RAZORPAY, BANK
     total_amount DECIMAL(10,2),
     total_transactions INTEGER,
     matched_count INTEGER,
     unmatched_count INTEGER,
     report_file_url TEXT,
     metadata JSONB,
     created_at TIMESTAMP
   );
   ```

6. **payment_intents** ❌
   ```sql
   CREATE TABLE payment_intents (
     id UUID PRIMARY KEY,
     invoice_id UUID REFERENCES invoices(id),
     amount DECIMAL(10,2),
     allowed_methods JSONB, -- ['UPI', 'CARD', 'WALLET', 'CASH', 'POS']
     status VARCHAR(50), -- CREATED, COMPLETED, CANCELLED
     created_at TIMESTAMP
   );
   ```

### Missing Columns

1. **invoices** table:
   - `send_failures` JSONB (array of failed send attempts)
   - `balance_due` DECIMAL(10,2)
   - `read_only` BOOLEAN (for archival)
   - `archived_at` TIMESTAMP

2. **service_leads** table:
   - `read_only` BOOLEAN
   - `archived_at` TIMESTAMP
   - `cse_followup_due` BOOLEAN
   - `csat` INTEGER (1-5)
   - `cse_notes` TEXT

3. **payment_transactions** table:
   - `reconciled` BOOLEAN
   - `reconciled_at` TIMESTAMP
   - `reconciled_by` UUID
   - `cash_deposit_pending` BOOLEAN
   - `bank_deposit_slip_url` TEXT

4. **workshop_payouts** table:
   - `payout_batch_id` UUID
   - `csv_file_url` TEXT
   - `supporting_docs` JSONB

---

## 📝 STEP-BY-STEP IMPLEMENTATION PLAN

### STEP 0: PRE-STEP (Current State)

**Status:** ✅ Already Implemented

**What exists:**
- Mechanic marks job complete
- Supervisor QC approval
- Invoice generation
- Status: `WORK_COMPLETE` → `INVOICE_GENERATED` → `AWAITING_PAYMENT`

**Actions Required:**
- ✅ Lock job card for edits (already done)
- ⚠️ Create finance_event for invoice_created (needs implementation)
- ⚠️ Queue invoice for billing review (needs implementation)

---

### STEP 1: INVOICE REVIEW & APPROVAL

**Status:** ✅ 80% Complete

**What exists:**
- ✅ Invoice approval API
- ✅ Invoice rejection API
- ✅ Invoice review records
- ✅ UI for review

**What's missing:**
- ⚠️ Line items validation vs `lead_pricing_items` and `lead_pricing_snapshot`
- ⚠️ Extra charges validation (status = APPROVED check)
- ⚠️ Tax calculation verification UI
- ⚠️ B2B GSTIN confirmation
- ⚠️ Discrepancy flagging (red flags in UI)
- ⚠️ Finance Manager second approval for high-value invoices
- ⚠️ Threshold configuration
- ⚠️ finance_event logging

**Implementation Tasks:**

1. **Database:**
   - ✅ `invoice_reviews` table exists
   - ⚠️ Add `finance_events` table (see schema above)

2. **API Enhancements:**
   - Enhance `/api/billing/invoices/[id]/approve`:
     - Add line items validation
     - Add extra charges validation
     - Add tax verification
     - Add threshold check for second approval
     - Add finance_event creation
   - Create `/api/billing/invoices/[id]/validate`:
     - Validate line items
     - Validate extra charges
     - Validate tax calculations
     - Return validation results

3. **UI Enhancements:**
   - Add validation checklist in review page
   - Add red flags for mismatches
   - Add second approval workflow UI
   - Add threshold configuration UI

**Files to Create/Update:**
- `apps/web/src/app/api/billing/invoices/[id]/validate/route.ts` (NEW)
- `apps/web/src/app/dashboard/billing/invoices/[id]/review/page.tsx` (UPDATE)
- `apps/web/src/lib/services/financeEventService.ts` (NEW)
- `database/finance_events_table.sql` (NEW)

---

### STEP 2: SHARE INVOICE WITH CUSTOMER

**Status:** ✅ 70% Complete

**What exists:**
- ✅ Invoice sharing API
- ✅ Email sending
- ✅ SMS sending
- ✅ Sharing logs

**What's missing:**
- ⚠️ WhatsApp Business API integration
- ⚠️ PDF generation before sending
- ⚠️ Short URL generation
- ⚠️ Delivery status tracking
- ⚠️ Retry mechanism for failed sends
- ⚠️ `send_failures` array tracking
- ⚠️ lead_event creation

**Implementation Tasks:**

1. **API Enhancements:**
   - Enhance `/api/billing/invoices/[id]/send`:
     - Generate PDF before sending
     - Create short URL
     - Implement retry mechanism
     - Track delivery status
     - Update `send_failures` array
     - Create lead_event entries

2. **WhatsApp Integration:**
   - Integrate WhatsApp Business API
   - Create WhatsApp template
   - Handle delivery receipts

3. **Short URL Service:**
   - Create URL shortening service
   - Track clicks and views

**Files to Create/Update:**
- `apps/web/src/lib/services/whatsappService.ts` (NEW)
- `apps/web/src/lib/services/urlShortener.ts` (NEW)
- `apps/web/src/app/api/billing/invoices/[id]/send/route.ts` (UPDATE)
- `apps/web/src/app/api/billing/invoices/[id]/generate-pdf/route.ts` (UPDATE)

---

### STEP 3: ENABLE & SHOW PAYMENT OPTIONS

**Status:** ⚠️ 50% Complete

**What exists:**
- ✅ Razorpay integration
- ✅ Payment button component
- ✅ Basic payment UI

**What's missing:**
- ❌ `payment_intents` table
- ❌ `workshop_payment_policy` table
- ❌ Payment method derivation from policy
- ❌ Corporate vs retail customer handling
- ❌ Split payment support
- ❌ QR code generation
- ❌ Corporate billing option
- ❌ Partial payment widget
- ❌ `balance_due` calculation

**Implementation Tasks:**

1. **Database:**
   - Create `payment_intents` table
   - Create `workshop_payment_policy` table
   - Add `balance_due` to `invoices` table

2. **API:**
   - Create `/api/payments/invoices/[id]/create-intent`:
     - Derive payment methods from policy
     - Create payment_intent record
     - Return allowed methods
   - Create `/api/payments/invoices/[id]/qr-code`:
     - Generate QR code for UPI
     - Return QR code image

3. **UI:**
   - Update payment page with all options
   - Add split payment widget
   - Add QR code display
   - Add corporate billing option
   - Show balance_due

**Files to Create/Update:**
- `database/payment_intents_table.sql` (NEW)
- `database/workshop_payment_policy_table.sql` (NEW)
- `apps/web/src/app/api/payments/invoices/[id]/create-intent/route.ts` (NEW)
- `apps/web/src/app/api/payments/invoices/[id]/qr-code/route.ts` (NEW)
- `apps/web/src/app/dashboard/billing/invoices/[id]/payment/page.tsx` (UPDATE)
- `apps/web/src/app/invoice/[invoice_number]/page.tsx` (UPDATE)

---

### STEP 4: COLLECT PAYMENT (Multiple Flows)

**Status:** ✅ 60% Complete

**What exists:**
- ✅ Online payment (Razorpay)
- ✅ Payment verification
- ✅ Webhook handling
- ✅ Payment transaction records

**What's missing:**
- ⚠️ Cash collection at workshop
- ⚠️ POS payment recording
- ⚠️ COD workflow
- ⚠️ Partial payment handling
- ⚠️ Duplicate transaction detection
- ⚠️ `cash_deposit_pending` tracking
- ⚠️ Receipt generation on payment

**Implementation Tasks:**

1. **API Enhancements:**
   - Enhance `/api/payments/invoices/[id]/record-payment`:
     - Add cash collection
     - Add POS payment
     - Add COD workflow
     - Add duplicate detection
     - Update `cash_deposit_pending` flag
     - Generate receipt

2. **UI:**
   - Add cash collection form
   - Add POS payment form
   - Add COD option
   - Add partial payment widget

**Files to Create/Update:**
- `apps/web/src/app/api/payments/invoices/[id]/record-payment/route.ts` (UPDATE)
- `apps/web/src/app/dashboard/billing/invoices/[id]/payment/page.tsx` (UPDATE)

---

### STEP 5: RECEIPT GENERATION & CUSTOMER CONFIRMATION

**Status:** ⚠️ 40% Complete

**What exists:**
- ✅ PDF service exists
- ✅ Email template exists

**What's missing:**
- ⚠️ Receipt PDF generation
- ⚠️ Receipt attachment to email
- ⚠️ Receipt URL storage
- ⚠️ lead_event: receipt_sent
- ⚠️ finance_event: receipt_created
- ⚠️ Invoice modification request workflow

**Implementation Tasks:**

1. **API:**
   - Create `/api/payments/invoices/[id]/generate-receipt`:
     - Generate receipt PDF
     - Store receipt URL
     - Send to customer
     - Create events

2. **Receipt Template:**
   - Create receipt HTML template
   - Include payment details
   - Include transaction reference

**Files to Create/Update:**
- `apps/web/src/app/api/payments/invoices/[id]/generate-receipt/route.ts` (NEW)
- `apps/web/src/lib/templates/receiptTemplate.ts` (NEW)
- `apps/web/src/lib/services/pdfService.ts` (UPDATE)

---

### STEP 6: DELIVERY / VEHICLE HANDOVER

**Status:** ✅ 80% Complete

**What exists:**
- ✅ Delivery assignment
- ✅ OTP verification
- ✅ Delivery images
- ✅ Status updates

**What's missing:**
- ⚠️ Payment verification before delivery
- ⚠️ COD policy check
- ⚠️ Damage reporting workflow
- ⚠️ support_ticket creation on damage
- ⚠️ Delivery confirmation to customer

**Implementation Tasks:**

1. **API Enhancements:**
   - Enhance delivery APIs:
     - Check payment status
     - Check COD policy
     - Handle damage reports
     - Create support tickets

**Files to Create/Update:**
- `apps/web/src/app/api/pickup/tasks/[id]/drop/complete/route.ts` (UPDATE)

---

### STEP 7: CSE FOLLOW-UP & SATISFACTION CAPTURE

**Status:** ✅ 70% Complete

**What exists:**
- ✅ CSE follow-up API
- ✅ Rating collection
- ✅ Feedback notes

**What's missing:**
- ⚠️ `cse_followup_due` flag
- ⚠️ Automated follow-up queue
- ⚠️ Call script integration
- ⚠️ support_ticket creation
- ⚠️ Escalation workflow
- ⚠️ `csat` and `cse_notes` fields

**Implementation Tasks:**

1. **Database:**
   - Add `cse_followup_due` to `service_leads`
   - Add `csat` to `service_leads`
   - Add `cse_notes` to `service_leads`

2. **API:**
   - Create `/api/cse/follow-up-queue`:
     - Get leads with `cse_followup_due = true`
     - Filter by time window
   - Enhance `/api/cse/leads/[id]/follow-up`:
     - Create support tickets
     - Handle escalations

3. **UI:**
   - Add follow-up queue dashboard
   - Add call script UI
   - Add escalation UI

**Files to Create/Update:**
- `database/add_cse_fields.sql` (NEW)
- `apps/web/src/app/api/cse/follow-up-queue/route.ts` (NEW)
- `apps/web/src/app/api/cse/leads/[id]/follow-up/route.ts` (UPDATE)
- `apps/web/src/app/dashboard/cse/follow-up-queue/page.tsx` (NEW)

---

### STEP 8: ACCOUNTS RECONCILIATION & LEDGER POSTING

**Status:** ❌ 0% Complete

**What's missing:**
- ❌ Reconciliation system
- ❌ GL posting
- ❌ Exception handling
- ❌ Settlement report processing
- ❌ Bank statement import
- ❌ Auto-matching logic

**Implementation Tasks:**

1. **Database:**
   - Create `recon_exceptions` table
   - Create `gl_entries` table
   - Create `settlement_reports` table

2. **API:**
   - Create `/api/reconciliation/import-statement`:
     - Import bank/PG statements
     - Auto-match transactions
   - Create `/api/reconciliation/exceptions`:
     - Get unmatched items
     - Resolve exceptions
   - Create `/api/reconciliation/post-gl`:
     - Post GL entries
     - Double-entry bookkeeping

3. **UI:**
   - Create reconciliation dashboard
   - Create exception management UI
   - Create GL viewer

**Files to Create:**
- `database/reconciliation_tables.sql` (NEW)
- `apps/web/src/app/api/reconciliation/import-statement/route.ts` (NEW)
- `apps/web/src/app/api/reconciliation/exceptions/route.ts` (NEW)
- `apps/web/src/app/api/reconciliation/post-gl/route.ts` (NEW)
- `apps/web/src/app/dashboard/accounts/reconciliation/page.tsx` (NEW)

---

### STEP 9: WORKSHOP PAYOUT SCHEDULING

**Status:** ⚠️ 30% Complete

**What exists:**
- ✅ `workshop_payouts` table
- ✅ Basic payout calculation API

**What's missing:**
- ❌ Payout cycle automation
- ❌ Payout batch creation
- ❌ Approval workflow
- ❌ Bank API integration
- ❌ CSV generation
- ❌ Remittance advice
- ❌ Failed transfer handling

**Implementation Tasks:**

1. **Database:**
   - Create `payout_items` table
   - Add `payout_batch_id` to `workshop_payouts`
   - Add `csv_file_url` to `workshop_payouts`

2. **API:**
   - Create `/api/payouts/calculate`:
     - Calculate payout for period
     - Create payout_items
   - Create `/api/payouts/batch/create`:
     - Create payout batch
     - Generate CSV
   - Create `/api/payouts/batch/[id]/approve`:
     - Approval workflow
   - Create `/api/payouts/batch/[id]/execute`:
     - Execute bank transfer
     - Handle failures

3. **UI:**
   - Create payout dashboard
   - Create batch management UI
   - Create approval UI

**Files to Create:**
- `database/payout_items_table.sql` (NEW)
- `apps/web/src/app/api/payouts/calculate/route.ts` (NEW)
- `apps/web/src/app/api/payouts/batch/create/route.ts` (NEW)
- `apps/web/src/app/api/payouts/batch/[id]/approve/route.ts` (NEW)
- `apps/web/src/app/api/payouts/batch/[id]/execute/route.ts` (NEW)
- `apps/web/src/app/dashboard/finance/payouts/page.tsx` (NEW)

---

### STEP 10: HANDLE REFUNDS / DISPUTES / CHARGEBACKS

**Status:** ⚠️ 20% Complete

**What exists:**
- ✅ `refund_requests` table

**What's missing:**
- ❌ Refund workflow
- ❌ Approval workflow
- ❌ Auto-approval for small amounts
- ❌ PG refund processing
- ❌ Chargeback handling
- ❌ Evidence collection
- ❌ GL reversal entries

**Implementation Tasks:**

1. **API:**
   - Create `/api/refunds/request`:
     - Create refund request
     - Collect evidence
   - Create `/api/refunds/[id]/approve`:
     - Approval workflow
     - Process refund
   - Create `/api/refunds/[id]/process`:
     - Process via PG
     - Create GL reversals
   - Create `/api/refunds/chargeback`:
     - Handle chargeback
     - Collect evidence

2. **UI:**
   - Create refund request UI
   - Create refund management dashboard
   - Create chargeback management UI

**Files to Create:**
- `apps/web/src/app/api/refunds/request/route.ts` (NEW)
- `apps/web/src/app/api/refunds/[id]/approve/route.ts` (NEW)
- `apps/web/src/app/api/refunds/[id]/process/route.ts` (NEW)
- `apps/web/src/app/api/refunds/chargeback/route.ts` (NEW)
- `apps/web/src/app/dashboard/finance/refunds/page.tsx` (NEW)

---

### STEP 11: ARCHIVE JOB & LOCK RECORDS

**Status:** ❌ 0% Complete

**What's missing:**
- ❌ Archival system
- ❌ Record locking
- ❌ Immutable storage
- ❌ Checksum generation
- ❌ Retention policy

**Implementation Tasks:**

1. **Database:**
   - Add `read_only` to `service_leads`
   - Add `read_only` to `invoices`
   - Add `archived_at` to both tables

2. **API:**
   - Create `/api/leads/[id]/archive`:
     - Lock records
     - Move to immutable storage
     - Generate checksums
   - Create `/api/leads/[id]/history`:
     - Read-only historical view

3. **Storage:**
   - Implement WORM storage
   - Generate checksums
   - Store metadata

**Files to Create:**
- `database/archival_fields.sql` (NEW)
- `apps/web/src/app/api/leads/[id]/archive/route.ts` (NEW)
- `apps/web/src/lib/services/archivalService.ts` (NEW)

---

### STEP 12: REPORTING & KPIs UPDATE

**Status:** ⚠️ 40% Complete

**What exists:**
- ✅ Basic analytics
- ✅ Some dashboards

**What's missing:**
- ❌ Complete KPI tracking
- ❌ SLA monitoring
- ❌ Revenue reports
- ❌ DSO calculation
- ❌ Daily collections report
- ❌ Payout reports
- ❌ Refund reports
- ❌ CSAT tracking
- ❌ SLA breach alerts
- ❌ Scheduled email digests

**Implementation Tasks:**

1. **API:**
   - Create `/api/reports/revenue`:
     - Revenue reports
     - DSO calculation
   - Create `/api/reports/collections`:
     - Daily collections
   - Create `/api/reports/payouts`:
     - Payout reports
   - Create `/api/reports/kpis`:
     - KPI calculations
   - Create `/api/reports/sla`:
     - SLA monitoring
     - Breach alerts

2. **UI:**
   - Create reporting dashboard
   - Create KPI dashboard
   - Create SLA monitoring UI

**Files to Create:**
- `apps/web/src/app/api/reports/revenue/route.ts` (NEW)
- `apps/web/src/app/api/reports/collections/route.ts` (NEW)
- `apps/web/src/app/api/reports/kpis/route.ts` (NEW)
- `apps/web/src/app/dashboard/reports/page.tsx` (NEW)

---

### STEP 13: NOTIFICATIONS & AUDIT TRAIL

**Status:** ⚠️ 50% Complete

**What exists:**
- ✅ Basic event logging
- ✅ Some notifications

**What's missing:**
- ❌ Complete event bus
- ❌ `finance_events` table
- ❌ `lead_events` table (exists but needs enhancement)
- ❌ Push notifications (FCM)
- ❌ WebSocket integration
- ❌ Event search
- ❌ Admin audit UI
- ❌ Critical event alerts

**Implementation Tasks:**

1. **Database:**
   - Create `finance_events` table
   - Enhance `lead_events` table

2. **API:**
   - Create event bus service
   - Create notification service
   - Create webhook service

3. **UI:**
   - Create audit trail viewer
   - Create event search UI

**Files to Create:**
- `database/finance_events_table.sql` (NEW)
- `apps/web/src/lib/services/eventBus.ts` (NEW)
- `apps/web/src/lib/services/notificationService.ts` (NEW)
- `apps/web/src/app/dashboard/admin/audit/page.tsx` (NEW)

---

## 📅 IMPLEMENTATION PRIORITY

### Phase 1: Core Payment Flow (Week 1-2)
1. ✅ Invoice Review & Approval (Enhancements)
2. ✅ Invoice Sharing (WhatsApp + PDF)
3. ✅ Payment Options (All methods)
4. ✅ Payment Collection (Cash/POS/COD)
5. ✅ Receipt Generation

### Phase 2: Delivery & Follow-up (Week 3)
6. ✅ Delivery Enhancements
7. ✅ CSE Follow-up Enhancements

### Phase 3: Finance & Reconciliation (Week 4-5)
8. ❌ Reconciliation System
9. ❌ Workshop Payouts (Full automation)
10. ❌ Refunds & Disputes

### Phase 4: Archival & Reporting (Week 6)
11. ❌ Archival System
12. ❌ Reporting & KPIs
13. ❌ Notifications & Audit Trail

---

## 🎯 SUCCESS CRITERIA

- [ ] All 13 steps fully implemented
- [ ] All database tables created
- [ ] All APIs functional
- [ ] All UI components built
- [ ] End-to-end flow tested
- [ ] Documentation complete
- [ ] Production ready

---

## 📝 NOTES

- This is a comprehensive plan covering all aspects of the invoice and payment flow
- Some steps are already partially implemented
- Priority should be given to completing the core payment flow first
- Each step should be tested independently before integration
- Database migrations should be run in order
- All APIs should follow RESTful conventions
- All UI should be responsive and accessible

---

**Last Updated:** November 26, 2025  
**Next Review:** After Phase 1 completion

