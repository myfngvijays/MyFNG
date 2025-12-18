# MyFNG — Code-Derived Project Documentation (Web + Mobile + Supabase)

> **Scope:** Ye document **sirf codebase** (pages, API routes, services, RN screens) read karke banaya gaya hai. Existing markdown docs ko source-of-truth nahi maana gaya.
>
> **Important:** Is doc me koi secrets/keys include nahi kiye gaye. `git push` ya `build` steps intentionally include nahi kiye.

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Tech Stack (as implemented)](#2-tech-stack-as-implemented)
- [3. Repo Structure (code-oriented)](#3-repo-structure-code-oriented)
- [4. Auth + Role Routing](#4-auth--role-routing)
- [5. Core Data Model (tables used in code)](#5-core-data-model-tables-used-in-code)
- [6. Lead Status Workflow (canonical in code)](#6-lead-status-workflow-canonical-in-code)
- [7. End-to-End Workflows](#7-end-to-end-workflows)
  - [7A. Web Booking Wizard (/book-service)](#7a-web-booking-wizard-book-service)
  - [7B. Customer Create Lead (authenticated)](#7b-customer-create-lead-authenticated)
  - [7C. Workshop Accept/Reject Lead](#7c-workshop-acceptreject-lead)
  - [7D. Assign Team (mechanic/supervisor/pickup)](#7d-assign-team-mechanicsupervisorpickup)
  - [7E. Mechanic Complete → QC Handoff](#7e-mechanic-complete--qc-handoff)
  - [7F. Supervisor QC Approve/Reject](#7f-supervisor-qc-approvereject)
  - [7G. Billing: Generate Invoice](#7g-billing-generate-invoice)
  - [7H. Billing: Send Invoice (email/sms/whatsapp/in-app)](#7h-billing-send-invoice-emailsmswhatsappin-app)
  - [7I. Payments: Create Intent / Verify / Webhook](#7i-payments-create-intent--verify--webhook)
  - [7J. Pickup/Drop: OTP + Delivery Complete](#7j-pickupdrop-otp--delivery-complete)
  - [7K. CSE Final Call + Complaint Ticket](#7k-cse-final-call--complaint-ticket)
- [8. Notifications (web + mobile realtime)](#8-notifications-web--mobile-realtime)
- [9. Supabase Storage Buckets (from code)](#9-supabase-storage-buckets-from-code)
- [10. Environment Variables (from code)](#10-environment-variables-from-code)
- [11. Local Run Commands (from code/scripts)](#11-local-run-commands-from-codescripts)
- [12. Known Code-Level Inconsistencies / Risks](#12-known-code-level-inconsistencies--risks)

---

## 1) System Overview

MyFNG ek multi-role workshop operations platform hai jisme:

- **Customer** booking/lead create karta hai (web booking wizard + customer create-lead)
- **Lead Manager / managers** lead allocation/assignment handle karte hain (APIs exist)
- **Workshop Admin/Supervisor** workshop-side acceptance + team assignment + operations manage karte hain
- **Mechanic** job execute karta hai, mandatory photos upload karta hai, aur job “WORK_COMPLETED” mark karta hai
- **Supervisor** QC approve/reject karta hai; reject par rework loop
- **Billing/Accounts** invoice generate + send karte hain; payment capture ke baad delivery allowed
- **Pickup Boy** pickup/drop + OTP verification + delivery completion
- **CSE** post-delivery final call; happy => close, unhappy => complaint ticket

---

## 2) Tech Stack (as implemented)

### Web
- **Next.js 14** App Router (`apps/web/src/app/**`)
- **React + TypeScript**
- **Tailwind CSS**
- **Supabase JS** via `@supabase/ssr`
  - Browser client: `apps/web/src/lib/supabase/client.ts`
  - Server client: `apps/web/src/lib/supabase/server.ts`
- **Next.js Route Handlers** as backend: `apps/web/src/app/api/**/route.ts`
- **Razorpay** integration for payments

### Mobile
- **React Native (Expo)**
- **Supabase JS** with AsyncStorage sessions
  - `apps/mobile/src/lib/supabase.ts`

### Backend
- **Supabase** (Postgres + Auth + Storage + Realtime)
- **Razorpay Webhooks** for reconciliation

---

## 3) Repo Structure (code-oriented)

### Web
- Pages: `apps/web/src/app/**/page.tsx`
- API routes: `apps/web/src/app/api/**/route.ts`
- Shared auth state: `apps/web/src/store/authStore.ts`
- Common dashboard guard/layout: `apps/web/src/components/DashboardLayout.tsx`
- Status workflow engine: `apps/web/src/lib/services/leadStatusService.ts`

### Mobile
- Entry: `apps/mobile/App.tsx`, `apps/mobile/index.js`
- Role-based navigation: `apps/mobile/src/navigation/DashboardNavigator.tsx`
- Auth context: `apps/mobile/src/context/AuthContext.tsx`
- Notifications context: `apps/mobile/src/context/NotificationContext.tsx`

### Shared
- Roles + permissions: `shared/constants/roles.ts`

---

## 4) Auth + Role Routing

### 4.1 Web login
- File: `apps/web/src/app/login/page.tsx`
- Flow:
  - `supabase.auth.signInWithPassword(...)`
  - profile fetch from `users_login` with joins:
    - `role:roles(role_code, role_name)`
    - `workshop:workshops(*)`
  - redirect: `/dashboard/{role_code.toLowerCase()}`

### 4.2 Web dashboard protection
- File: `apps/web/src/components/DashboardLayout.tsx`
- Flow:
  - `supabase.auth.getUser()`
  - `users_login` profile fetch
  - role mismatch => redirect to correct role dashboard

### 4.3 Mobile auth
- File: `apps/mobile/App.tsx`
- Startup:
  - `supabase.auth.getSession()`
  - if session exists => fetch `users_login` with join: `roles!role_id(role_code, role_name)`

### 4.4 Mobile role-based dashboard
- File: `apps/mobile/src/navigation/DashboardNavigator.tsx`
- Role code extraction (robust):
  - `userProfile?.role?.role_code` OR fallback variants
- Role → navigator mapping for many roles.

---

## 5) Core Data Model (tables used in code)

> Ye list code me directly referenced tables par based hai.

### Identity & org
- `users_login`
- `roles`
- `workshops`

### Leads & workflow
- `service_leads`

### Audit/history
- `lead_status_history`
- `lead_activities`
- `lead_events`
- `audit_logs`

### Workshop execution
- `mechanic_jobs`
- `mechanic_assignments`
- `mechanic_job_photos`
- `qc_checks`

### Billing & finance
- `invoices`
- `invoice_reviews`
- `invoice_sharing_logs`
- `payment_transactions`
- (finance events) via `apps/web/src/lib/services/financeEventService.ts`

### Pickup/Delivery
- `pickup_tracking`
- `pickup_otps`
- `pickup_location_tracking`
- `vehicle_condition_photos`

### Customer support
- `customer_support_tickets`

### Notifications
- `notifications`
- `notification_logs`

---

## 6) Lead Status Workflow (canonical in code)

Source: `apps/web/src/lib/services/leadStatusService.ts`

Key statuses used across APIs:
- Intake: `NEW`, `ASSIGNED`, `ACCEPTED`, `REJECTED`, `CANCELLED`
- Work: `IN_PROGRESS`, `WORK_COMPLETED`, `REWORK_REQUIRED`
- QC: `QC_PENDING`, `QC_APPROVED`, (reject uses `REWORK_REQUIRED` + `qc_status=FAILED`)
- Audit: `AUDIT_PENDING`, `AUDIT_APPROVED`, `AUDIT_FLAGGED`
- Billing: `READY_FOR_BILLING`, `INVOICE_GENERATED`, `AWAITING_PAYMENT`
- Payment: `PAID`, `PARTIAL_PAYMENT`, `COD_PENDING`
- Delivery: `READY_FOR_DELIVERY`, `DELIVERED_TO_CUSTOMER`
- Post-delivery: `COMPLAINT_OPENED`, `COMPLETED`, `CLOSED`

Role-based permissions are enforced in the workflow service and also in many API routes.

---

## 7) End-to-End Workflows

### 7A) Web Booking Wizard (/book-service)
- Page: `apps/web/src/app/book-service/page.tsx`
- “Pay Later”:
  - Direct insert into `service_leads` from browser using Supabase client
  - Example fields: `lead_number`, `created_from='WEB'`, `status='NEW'`, `pickup_required`, `service_type_ids`, `estimated_amount`, etc.
- “Pay Now” (booking payment, not invoice payment):
  - `POST /api/payments/create-booking-order` → Razorpay order
  - `POST /api/payments/verify-booking` → signature + payment status
  - Verified => then create lead (same insert)

Booking payment endpoints:
- `apps/web/src/app/api/payments/create-booking-order/route.ts`
- `apps/web/src/app/api/payments/verify-booking/route.ts`

### 7B) Customer Create Lead (authenticated)
- Page: `apps/web/src/app/customer/create-lead/page.tsx`
- Auth required; reads `customers` table (customer profile)
- Inserts `service_leads`
- Uploads photos to bucket **`myfng-media`** and writes metadata to `lead_media`
- Creates `lead_events` (`LEAD_CREATED`)

### 7C) Workshop Accept/Reject Lead
Accept:
- Endpoint: `POST /api/leads/[id]/accept`
- File: `apps/web/src/app/api/leads/[id]/accept/route.ts`
- Validates:
  - role: `WORKSHOP_ADMIN` or `WORKSHOP_SUPERVISOR`
  - lead belongs to workshop
  - lead.status == `ASSIGNED`
- Writes:
  - `service_leads.status = ACCEPTED`, timestamps
  - `lead_events`, `audit_logs`

Reject:
- Endpoint: `POST /api/leads/[id]/reject`
- File: `apps/web/src/app/api/leads/[id]/reject/route.ts`
- Validates:
  - role: `WORKSHOP_ADMIN`
  - lead.status == `ASSIGNED`
- Writes:
  - `service_leads.status = REJECTED`, rejected_reason/notes
  - `lead_events`, `audit_logs`

### 7D) Assign Team (mechanic/supervisor/pickup)
- Endpoint: `POST /api/workshop/leads/[id]/assign-team`
- File: `apps/web/src/app/api/workshop/leads/[id]/assign-team/route.ts`
- Validates:
  - caller role: `WORKSHOP_ADMIN` or `WORKSHOP_SUPERVISOR`
  - assigned users are in same workshop + correct role
- Writes:
  - Updates assignments on `service_leads`
  - Inserts `lead_status_history`, `lead_activities`
  - Inserts/updates `mechanic_jobs` (mechanic visibility)
  - Inserts `mechanic_assignments`

### 7E) Mechanic Complete → QC Handoff
- Endpoint: `POST /api/mechanic/jobs/[id]/complete`
- File: `apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`
- Hard validations:
  - role must be `WORKSHOP_MECHANIC`
  - lead must be assigned to mechanic
  - lead not `read_only`
  - lead in allowed status set
  - **mandatory photos**:
    - structured: `mechanic_job_photos` must contain required BEFORE + AFTER (including old parts + odometer) and at least 1 DURING
    - fallback legacy: `lead_media` counts
- Writes:
  - `service_leads.status = WORK_COMPLETED`
  - `service_leads.qc_status = PENDING`
  - `lead_status_history`, `lead_activities`, `lead_events`
  - updates `mechanic_jobs`, `mechanic_assignments`
  - notifies supervisor/admin via `notifyReadyForQC` (notifications table)

### 7F) Supervisor QC Approve/Reject
Approve:
- Endpoint: `POST /api/supervisor/jobs/[id]/approve-qc`
- File: `apps/web/src/app/api/supervisor/jobs/[id]/approve-qc/route.ts`
- Writes:
  - `service_leads.status = QC_APPROVED`, `qc_status=PASSED`
  - `qc_checks` upsert
  - then:
    - `AUDIT_PENDING` if `audit_required` else `READY_FOR_BILLING`
  - logs into `lead_status_history`, `lead_activities`, `lead_events`

Reject:
- Endpoint: `POST /api/supervisor/jobs/[id]/reject-qc`
- File: `apps/web/src/app/api/supervisor/jobs/[id]/reject-qc/route.ts`
- Writes:
  - `service_leads.status = REWORK_REQUIRED`, `qc_status=FAILED`
  - `mechanic_jobs.mechanic_status = IN_PROGRESS`
  - `qc_checks` upsert
  - logs + notifications to mechanic

### 7G) Billing: Generate Invoice
- Endpoint: `POST /api/billing/leads/[id]/generate-invoice`
- File: `apps/web/src/app/api/billing/leads/[id]/generate-invoice/route.ts`
- Pricing aggregation sources (code priority):
  - `lead_pricing_items` (ACTIVE)
  - workshop pricing: `workshop_service_pricing` + `workshop_service_addons_pricing`
  - lead amount fallbacks: `estimated_amount`, `estimated_cost`, `actual_amount`, `final_amount`, `total_price`
  - plus: approved `lead_extra_charges` + `job_cards/job_card_parts`
- Writes:
  - insert into `invoices` (line_items, taxes, place_of_supply, warranty, bank details)
  - update `service_leads.invoice_id` + `status = INVOICE_GENERATED`
  - lock `job_cards` after invoice generation
  - logs to `lead_status_history`, `lead_activities`, `lead_events`
  - finance event via `createFinanceEvent`

### 7H) Billing: Send Invoice (email/sms/whatsapp/in-app)
- Endpoint: `POST /api/billing/invoices/[id]/send`
- File: `apps/web/src/app/api/billing/invoices/[id]/send/route.ts`
- Steps:
  - generate short link (url shortener service)
  - ensure printable document exists (persist-document) and use it as attachment/link
  - send via selected methods with retry + failure logging
- Writes:
  - update invoice flags and `invoice_sharing_logs`
  - if any send success => lead status set to `AWAITING_PAYMENT`
  - logs + finance event

### 7I) Payments: Create Intent / Verify / Webhook
Create payment intent (invoice payment):
- `POST /api/payments/create-intent`
- File: `apps/web/src/app/api/payments/create-intent/route.ts`
- Creates Razorpay order + inserts `payment_transactions` (PENDING)

Verify payment:
- `POST /api/payments/verify`
- File: `apps/web/src/app/api/payments/verify/route.ts`
- Updates `payment_transactions`, `invoices`, `service_leads`:
  - full payment => lead `READY_FOR_DELIVERY`
  - partial => `PARTIAL_PAYMENT`

Webhook:
- `POST /api/payments/webhook`
- File: `apps/web/src/app/api/payments/webhook/route.ts`
- Verifies webhook signature, applies idempotent settlement logic.

### 7J) Pickup/Drop: OTP + Delivery Complete
OTP verify:
- `POST /api/pickup/[id]/verify-otp`
- File: `apps/web/src/app/api/pickup/[id]/verify-otp/route.ts`
- Requires bearer token, checks assignment in `pickup_tracking`
- OTP rules:
  - universal test OTP `123456` accepted
  - else DB RPC: `verify_pickup_otp(...)`

Drop complete:
- `POST /api/pickup/[id]/drop/complete`
- File: `apps/web/src/app/api/pickup/[id]/drop/complete/route.ts`
- Requires:
  - lead status `READY_FOR_DELIVERY` or `COD_PENDING`
  - DROP OTP verified
  - invoice payment check (PAID/COD pending)
  - minimum 3 drop photos (`vehicle_condition_photos`)
- Writes:
  - updates `pickup_tracking`
  - updates `service_leads.status = DELIVERED_TO_CUSTOMER` + sets CSE followup due
  - logs to history/events/activities

### 7K) CSE Final Call + Complaint Ticket
- `POST /api/cse/leads/[id]/final-call`
- File: `apps/web/src/app/api/cse/leads/[id]/final-call/route.ts`
- If unhappy/follow-up required:
  - lead -> `COMPLAINT_OPENED`
  - creates `customer_support_tickets` (dedupe on open)
- If happy after delivery:
  - lead -> `COMPLETED` and becomes archived/read-only
  - emits marketing events + if invoice paid emits `READY_FOR_PAYOUT`

---

## 8) Notifications (web + mobile realtime)

### Server-side creation helpers
- `apps/web/src/lib/notifications.ts`
  - Inserts into `notifications` table
  - Helpers: `notifyReadyForQC`, `notifyQCDecision`, `notifyWorkshopAdmin`, `notifyAccountsTeam`, etc.

### Web realtime subscription
- `apps/web/src/lib/notifications/notificationService.ts`
  - Subscribes to `notifications` table changes (INSERT)
  - Can show browser notifications (permission based)

### Mobile realtime subscription
- `apps/mobile/src/context/NotificationContext.tsx`
  - Fetches notifications for user_id (from users_login)
  - Subscribes via realtime channel on `notifications` table
  - HIGH/URGENT => native alert

---

## 9) Supabase Storage Buckets (from code)

Buckets referenced:
- `service-media` (lead media, mechanic photos)
- `invoices` (persist invoice printable HTML)
- `car-brand` (brand logos)
- `workshop-assets` (workshop public page assets)
- `photos` (pickup/drop photos)
- `audit-media` (audit uploads)
- `myfng-media` (customer create-lead uploads)
- `media` (generic photo upload component)

---

## 10) Environment Variables (from code)

### Web (minimum)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Razorpay
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (frontend)
- `RAZORPAY_KEY_ID` (server fallback)
- `RAZORPAY_KEY_SECRET` (server)
- `RAZORPAY_WEBHOOK_SECRET` (webhook)

### WhatsApp (optional)
- `WHATSAPP_API_URL`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`

### Email (optional)
- `SENDGRID_API_KEY`
- `FROM_EMAIL`
- `FROM_NAME`

### SMS (optional)
- `NEXT_PUBLIC_SMS_PROVIDER`
- `TWILIO_*` or `MSG91_*` vars

### Mobile
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 11) Local Run Commands (from code/scripts)

Root scripts (`package.json`):
- `npm run web` → `apps/web` dev
- `npm run mobile` → `apps/mobile` expo start

Web scripts (`apps/web/package.json`):
- `npm run dev`
- `npm run build`
- `npm run start`

Mobile scripts (`apps/mobile/package.json`):
- `npm start`
- `npm run android`
- `npm run ios`

---

## 12) Known Code-Level Inconsistencies / Risks

1) **service_leads status column naming mismatch**
- Web APIs mostly use `status`
- Kuch mobile screens me `lead_status` referenced
- Recommendation: DB schema me canonical field decide karke mobile queries align.

2) **users_login lookup inconsistency**
- Kuch APIs assume `users_login.id == auth.user.id`
- Kuch APIs email/phone fallback use karte hain
- Recommendation: single consistent mapping + migration.

3) **Type definitions incomplete**
- `apps/web/src/types/database.ts` limited tables/columns define karta hai
- Actual code me many more columns/tables used.

4) **Payment read_only lock semantics**
- Payment verify/webhook code lead ko full payment par `read_only=true` karta hai
- Delivery flow bhi `read_only=true` set karta hai
- Ensure “read_only” guards required operations ko block na kar rahe hon (especially delivery).

---

## Appendix: Key Source Files Index

- Web booking: `apps/web/src/app/book-service/page.tsx`
- Web login: `apps/web/src/app/login/page.tsx`
- Web dashboard guard: `apps/web/src/components/DashboardLayout.tsx`
- Status engine: `apps/web/src/lib/services/leadStatusService.ts`
- Notifications helpers: `apps/web/src/lib/notifications.ts`
- Web realtime notifications: `apps/web/src/lib/notifications/notificationService.ts`
- Mobile entry: `apps/mobile/App.tsx`
- Mobile role navigator: `apps/mobile/src/navigation/DashboardNavigator.tsx`
- Mobile auth context: `apps/mobile/src/context/AuthContext.tsx`
- Mobile notifications context: `apps/mobile/src/context/NotificationContext.tsx`

