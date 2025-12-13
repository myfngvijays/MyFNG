# FULL POST-JOB COMPLETION WORKFLOW (EXTREME DETAIL)
# (Begins when Mechanic clicks “JOB COMPLETE”)

This document maps your **14-step** post-job workflow to the **actual** MyFNG implementation: **UI screens + API routes + DB tables + statuses**.

---

## 0) Canonical Status Model (IMPORTANT)

### Lead status (`service_leads.status`)
- **WORK_COMPLETED**: Mechanic finished work and submitted job for QC (mechanic “JOB COMPLETE”).
- **QC_APPROVED**: Supervisor QC passed (intermediate).
- **READY_FOR_BILLING**: Ready for invoice generation (billing begins).
- **INVOICE_GENERATED**: Invoice draft created in `invoices`.
- **AWAITING_PAYMENT**: Invoice approved/sent → waiting for payment.
- **READY_FOR_DELIVERY**: Payment done / COD pending → delivery can be done.
- **DELIVERED_TO_CUSTOMER**: Vehicle delivered to customer (OTP verified).
- **COMPLETED**: CSE post-delivery follow-up complete and customer happy (archived/read-only).
- **COMPLAINT_OPENED**: Customer unhappy/follow-up required; complaint ticket opened.
- **REWORK_REQUIRED**: QC failed → sent back to mechanic with notes.

### QC status (`service_leads.qc_status`)
- **PENDING**: Awaiting QC
- **PASSED**: QC passed
- **FAILED**: QC failed (rework required)

---

## 1) Supervisor Final QC (Quality Control)

### UI
- **Supervisor QC Queue**: `apps/web/src/app/dashboard/workshop_supervisor/qc-queue/page.tsx`
- **Supervisor Job Detail + QC Checklist**: `apps/web/src/app/dashboard/workshop_supervisor/jobs/[id]/page.tsx`
- **QC Checklist component**: `apps/web/src/components/supervisor/QCChecklist.tsx`
- **Photo Review (read-only)**: `apps/web/src/components/supervisor/PhotoValidationModal.tsx`

### APIs
- **Mechanic submits completion**: `POST /api/mechanic/jobs/[id]/complete`
  - File: `apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`
  - Enforces mandatory photos: BEFORE/DURING/AFTER + `AFTER_OLD_PARTS` + `AFTER_ODOMETER`
  - Writes: `service_leads.status = WORK_COMPLETED`, `service_leads.qc_status = PENDING`
- **Supervisor QC PASS**: `POST /api/supervisor/jobs/[id]/approve-qc`
  - File: `apps/web/src/app/api/supervisor/jobs/[id]/approve-qc/route.ts`
  - Writes: `qc_checks` upsert, status history, activities
  - Next status: `READY_FOR_BILLING` (or `AUDIT_PENDING` if `audit_required=true`)
- **Supervisor QC FAIL (Rework required)**: `POST /api/supervisor/jobs/[id]/reject-qc`
  - File: `apps/web/src/app/api/supervisor/jobs/[id]/reject-qc/route.ts`
  - Writes: `qc_checks` upsert, status history, activities
  - Next status: `REWORK_REQUIRED` + `qc_status=FAILED` (mechanic rework)

### DB tables involved
- `service_leads`
- `qc_checks`
- `lead_status_history`
- `lead_activities`
- `lead_events`

### Enforced QC checklist scope (as per your spec)
- **Physical quality check**: engine bay clean, bolts tightened, no leaks, tools not left, fluids filled, brake, noise/vibration, AC cooling, test drive, warning lights.
- **Photo verification**: BEFORE/DURING/AFTER + old parts proof (mandatory).
- **Extra work verification**: pending extra work disallowed; proof required if extra work exists.

---

## 2) Billing Finalization (Pricing, Taxes, Add-ons, Extra Work)

### Current implementation
Billing totals are computed from:
- `lead_pricing_items` (preferred)
- `workshop_service_pricing` + `workshop_service_addons_pricing` (fallback)
- `lead_extra_charges` where `status='APPROVED'`
- `job_cards` + `job_card_parts`

### API
- **Generate invoice**: `POST /api/billing/leads/[id]/generate-invoice`
  - File: `apps/web/src/app/api/billing/leads/[id]/generate-invoice/route.ts`
  - Writes: `invoices` row + locks `job_cards.locked_at` + sets `service_leads.status = INVOICE_GENERATED`
  - Enforces: billing checklist completed when provided

### UI (Billing team verification)
- Billing finalization checklist UI: `apps/web/src/app/dashboard/billing/leads/[id]/generate-invoice/page.tsx`

---

## 3) Invoice Generation (PDF invoice + storage)

### Current implementation
- Invoice record is created in `invoices`.
- There is a PDF generator endpoint used by UI:
  - `GET /api/billing/invoices/[id]/generate-pdf` (exists in repo; used by InvoiceSection)
 - Document persistence (stable URL):
   - `POST /api/billing/invoices/[id]/persist-document`
   - Stores `invoices.document_url` (HTML now; can be upgraded to true PDF later)

---

## 4) Invoice Sharing (WhatsApp / SMS / Email / In-app)

### APIs
- `POST /api/billing/invoices/[id]/send`
  - File: `apps/web/src/app/api/billing/invoices/[id]/send/route.ts`
  - Writes: `invoice_sharing_logs`, sets invoice sent flags, lead status to `AWAITING_PAYMENT`
- There is also `POST /api/invoices/[id]/send` (alternate multi-channel sender)

### Missing / TODO (still pending)
- WhatsApp depends on env vars (`WHATSAPP_*`). If not configured, WhatsApp send will fail.

---

## 5) Payment Collection (Online / Cash / COD / Partial)

### API
- Offline/Manual payment record:
  - `POST /api/payments/invoices/[id]/record-payment`
  - File: `apps/web/src/app/api/payments/invoices/[id]/record-payment/route.ts`
  - Writes: `payment_transactions`, updates `invoices`, and sets lead status to:
    - `READY_FOR_DELIVERY` (full paid)
    - `PARTIAL_PAYMENT` (partial)
    - `COD_PENDING` (COD)

### Online payment (Razorpay) - Implemented
- Create order (supports customer/public invoice link flows):
  - `POST /api/payments/create-intent`
  - Creates Razorpay order + `payment_transactions` row (`gateway_order_id`, `PENDING`)
- Verification (checkout callback):
  - `POST /api/payments/verify`
  - Verifies signature + fetches Razorpay payment status and updates DB
- Webhook reconciliation (authoritative):
  - `POST /api/payments/webhook`
  - Verifies webhook signature and updates `payment_transactions`, `invoices`, `service_leads`

---

## 6) Payment Remarks & Finance Logging

### Current implementation
- Payment record route stores:
  - `payment_mode`, `payment_reference/txn`, `staff_name`, `payment_remarks`
- Finance events:
  - `apps/web/src/lib/services/financeEventService.ts`

---

## 7) Vehicle Delivery + OTP

### Canonical implementation (production)
- **Canonical delivery tracking**: `pickup_tracking` + `pickup_otps` (otp_type: PICKUP/DROP)
  - Schema: `database/08_workshop_pickup_boy_enhancements.sql`
  - Delivery flow APIs:
    - `POST /api/pickup/[id]/drop/start` (generates DROP OTP via DB and starts OUT_FOR_DELIVERY)
    - `POST /api/pickup/[id]/arrive-at-customer-delivery` (marks ARRIVED_AT_CUSTOMER)
    - `POST /api/pickup/[id]/verify-otp` (verifies PICKUP/DROP OTP; supports universal test OTP)
    - `POST /api/pickup/[id]/drop/complete` (requires DROP OTP verified + payment check; marks lead DELIVERED_TO_CUSTOMER)
- **Delivery API**: `POST /api/delivery/[id]/complete`
  - Now also uses `pickup_otps(DROP)` + `pickup_tracking` so both paths remain consistent.

### OTP test rule (requested)
- **Universal OTP**: `123456` is accepted anywhere OTP is required.
  - Implemented in:
    - `apps/web/src/app/api/pickup/[id]/verify-otp/route.ts`
    - `apps/web/src/app/api/pickup/tasks/[id]/verify-otp/route.ts`
    - `apps/web/src/app/api/delivery/[id]/complete/route.ts`
  - Also ensures `pickup_otps` gets a **verified record** so downstream steps don’t fail.

### Decision resolved
- **Canonical source of truth** for OTP + delivery audit is `pickup_tracking` + `pickup_otps`.

---

## 8) CSE Follow-up (24–48 hours)

### API
- `POST /api/cse/leads/[id]/final-call`
  - File: `apps/web/src/app/api/cse/leads/[id]/final-call/route.ts`
  - Now supports:
    - **Happy customer** → `status=COMPLETED`, archive/read-only
    - **Unhappy / follow-up required** → `status=COMPLAINT_OPENED` (+ ticket)

### Complaint / Ticket workflow (Implemented)
- When status becomes **COMPLAINT_OPENED** from final call, system auto-creates a ticket in:
  - Table: `customer_support_tickets` (migration: `database/76_create_cse_support_tickets.sql`)
  - API creates:
    - `lead_activities` entry: `COMPLAINT_OPENED`
    - `lead_events` entry: `COMPLAINT_OPENED`

---

## 9) Audit Process (Optional)

### Current signals
- Lead field `audit_required` triggers `AUDIT_PENDING` in supervisor QC approval API.
- Auditor queue UI exists (mobile) and shared types exist.

### Implemented handoff
- Auditor approve:
  - API: `POST /api/auditor/leads/[id]/approve`
  - File: `apps/web/src/app/api/auditor/leads/[id]/approve/route.ts`
  - Transition: `AUDIT_APPROVED` → `READY_FOR_BILLING`
  - Logs: `lead_status_history`, `lead_events`
- Auditor flag:
  - API: `POST /api/auditor/leads/[id]/flag`
  - Transition: `AUDIT_FLAGGED`

---

## 10) Accounting & Workshop Payout

### Current implementation
- Finance/Payout screens + APIs exist:
  - `apps/web/src/app/api/payouts/*`
  - `apps/web/src/app/dashboard/finance/payouts/page.tsx`

### Implemented trigger (event-based)
- On lead **CLOSED** (CSE final call), if invoice is **PAID**, system emits:
  - `lead_events.event_type = READY_FOR_PAYOUT`
  - File: `apps/web/src/app/api/cse/leads/[id]/final-call/route.ts`
  - Note: actual payout creation/execution remains in finance dashboards/APIs.

---

## 11) Customer History Update (CRM + Maintenance Log)

### Current implementation
- Audit trail tables exist: `lead_status_history`, `lead_activities`, `lead_events`.
- Invoices stored in `invoices`.

### Implemented “service history” view (Lead timeline)
- UI: `apps/web/src/app/dashboard/super_admin/lead-history/[leadId]/page.tsx`
- API: `GET /api/audit/lead-history/[leadId]`
- Data: `lead_status_history`, `lead_activities`, `lead_events`

---

## 12) Marketing Automation

### Implemented triggers (event-based)
- On lead **COMPLETED**, system emits `lead_events`:
  - `GOOGLE_REVIEW_REQUEST`
  - `NEXT_SERVICE_REMINDER_SCHEDULED` (3 months + 6 months)
  - `LOYALTY_POINTS_AWARDED`
  - File: `apps/web/src/app/api/cse/leads/[id]/final-call/route.ts`
  - Note: actual sending is expected via worker/cron that reads these events.

---

## 13) Analytics Updated

### Current implementation
- KPI APIs exist (e.g. `apps/web/src/app/api/reports/kpis/route.ts`)
- Finance events exist

### Implemented event coverage (lead_events)
- Mechanic completion: `WORK_COMPLETED`
- QC pass/fail: `QC_APPROVED`, `QC_REJECTED`, plus next-stage event (`READY_FOR_BILLING` / `AUDIT_PENDING`)
- Delivery: `DELIVERED_TO_CUSTOMER`
- Closure: `LEAD_CLOSED` / `CUSTOMER_UNHAPPY`
- Finance trigger: `READY_FOR_PAYOUT`

---

## 14) System Archiving & Data Locking

### Current implementation
- Columns exist (migration): `read_only`, `archived_at`, `archived_by`, `retention_period_years`
  - `database/78_invoice_post_generation_updates.sql`
- Job card locking on invoice generation exists.

### Implemented server-side read_only guards (core endpoints)
- Mechanic complete: `apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`
- Mechanic extra work request: `apps/web/src/app/api/mechanic/jobs/[id]/request-extra-work/route.ts`
- Supervisor QC approve/reject/change-status:
  - `apps/web/src/app/api/supervisor/jobs/[id]/approve-qc/route.ts`
  - `apps/web/src/app/api/supervisor/jobs/[id]/reject-qc/route.ts`
  - `apps/web/src/app/api/supervisor/jobs/[id]/change-status/route.ts`
- Invoice generate/send/approve/reject:
  - `apps/web/src/app/api/billing/leads/[id]/generate-invoice/route.ts`
  - `apps/web/src/app/api/billing/invoices/[id]/send/route.ts`
  - `apps/web/src/app/api/billing/invoices/[id]/approve/route.ts`
  - `apps/web/src/app/api/billing/invoices/[id]/reject/route.ts`
- Payment record: `apps/web/src/app/api/payments/invoices/[id]/record-payment/route.ts`
- Pickup/drop + delivery complete:
  - `apps/web/src/app/api/pickup/[id]/drop/start/route.ts`
  - `apps/web/src/app/api/pickup/[id]/verify-otp/route.ts`
  - `apps/web/src/app/api/pickup/[id]/drop/complete/route.ts`
  - `apps/web/src/app/api/delivery/[id]/complete/route.ts`

### Remaining recommendation (DB-level)
- DB-level locking for `read_only` is now included in the consolidated pack:
  - `database/99_RUN_ALL_POST_JOB_WORKFLOW.sql`
  - Triggers:
    - `trigger_prevent_updates_when_read_only` on `service_leads`
    - `trigger_prevent_invoice_updates_when_read_only` on `invoices`
  - Note: if you want to lock additional tables (`pickup_tracking`, media, etc.), we can extend this trigger pattern.

---

## Current Work Done (this session)
- Mechanic job completion now sets **WORK_COMPLETED** (not final COMPLETED).
- QC pass now routes to **READY_FOR_BILLING** (billing no longer skipped).
- QC checklist now calls supervisor QC endpoints for consistent workflow.
- CSE final call now correctly logs status history and can close+archive a lead.
- Pickup/Drop delivery now enforces DROP OTP + payment and sets `DELIVERED_TO_CUSTOMER` + CSE followup due.
- Audit approval now moves to READY_FOR_BILLING.
- Unhappy CSE final call auto-creates `customer_support_tickets`.
- Universal OTP `123456` enabled across OTP-required endpoints (test mode).


