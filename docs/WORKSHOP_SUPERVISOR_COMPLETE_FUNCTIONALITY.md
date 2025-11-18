# 🚀 MYFNG — WORKSHOP SUPERVISOR COMPLETE FUNCTIONALITY

**Detailed, Step-by-Step, with Full Descriptions**

---

## Table of Contents

1. [Supervisor Dashboard (Home Screen)](#1-supervisor-dashboard-home-screen)
2. [Supervisor Responsibilities](#2-supervisor-responsibilities-high-level)
3. [Job List View (Supervisor View)](#3-job-list-view-supervisor-view)
4. [Full Job Details (Supervisor Version)](#4-full-job-details-supervisor-version)
5. [Workflow (Supervisor Control)](#5-workflow-supervisor-control)
6. [Supervisor Permissions (RBAC)](#6-supervisor-permissions-rbac)
7. [Supervisor KPIs (Performance Dashboard)](#7-supervisor-kpis-performance-dashboard)
8. [API Endpoints for Supervisor](#8-api-endpoints-for-supervisor)
9. [UI/UX Requirements](#9-uiux-requirements-for-supervisor-panel)
10. [Example Supervisor Workflow](#10-example-supervisor-workflow-realistic-scenario)
11. [Database Requirements](#11-database-requirements)

---

## 1. Supervisor Dashboard (Home Screen)

When the Supervisor logs in, they see an **overview operational dashboard**.

### Dashboard Widgets

- **Total Jobs Today**
- **Assigned Jobs**
- **In-Progress Jobs**
- **Jobs on HOLD / Waiting for Approval**
- **Jobs Completed (Awaiting QC)**
- **Pending Pickup / Drop**
- **Pending Extra Work Approvals**
- **SLA At-Risk Jobs**
- **Mechanic Performance Panel**

### Quick Filters

- ALL
- NEW
- ACCEPTED
- ASSIGNED
- IN PROGRESS
- HOLD
- COMPLETED (but not delivered)
- READY FOR DELIVERY

**Supervisor can filter by:**
- Mechanic
- Service type

---

## 2. Supervisor Responsibilities (High-Level)

### A. Manage Mechanics

- ✅ Assign jobs to mechanics (if admin permission allowed)
- ✅ Reassign jobs
- ✅ Track mechanic performance
- ✅ Approve or reject mechanic notes
- ✅ Verify mechanic checklist completion

### B. Oversee Job Progress

- ✅ Monitor every job from start to finish
- ✅ Check SLA timers
- ✅ Intervene when mechanic puts job on HOLD

### C. Quality Control

- ✅ Verify BEFORE, PROGRESS, AFTER images
- ✅ Confirm checklist accuracy
- ✅ Ensure genuine parts used
- ✅ Approve job completion

### D. Extra Work & Approvals

- ✅ Review extra work requests by mechanics
- ✅ Approve or reject with comments

### E. Customer Delivery

- ✅ Verify job as READY FOR DELIVERY
- ✅ Ensure clean car delivery
- ✅ Final QC before delivery

### F. Communication

- ✅ Act as bridge between Admin ↔ Mechanic ↔ Pickup Boy
- ✅ Add internal notes
- ✅ Escalate issues

---

## 3. Job List View (Supervisor View)

Supervisor sees a **more detailed list** than mechanic.

### Each Job Card Shows:

- Lead ID
- Customer name (masked)
- Vehicle number
- **Mechanic assigned**
- Service category
- **Current job stage**
- **SLA countdown**
- Extra work requested?
- Parts required?
- Pickup status
- **Image status:**
  - ✅ Before
  - ✅ Progress
  - ✅ After

### Actions on Job Card

- **View Full Job Details**
- **Move Job to HOLD**
- **Reassign Mechanic**
- **Approve images**
- **Approve extra work**
- **Mark job passed QC**
- **Mark READY FOR DELIVERY**

---

## 4. Full Job Details (Supervisor Version)

The supervisor sees a **high-control panel** with several sections.

### A. Job Summary

- Lead ID
- Status
- Assigned mechanic
- Assigned by
- Job start/repair timestamps
- SLA timer
- Expected completion time

### B. Customer & Vehicle Info

**Read-only section with:**

- Customer name (masked optional)
- Phone (admin-only permission)
- Vehicle registration
- Make/Model
- Odometer reading
- Customer complaints
- Requested services

### C. Service Package Details

Supervisor sees:

- All services selected
- Add-ons (Oil type, AC gas, brake cleaning, etc.)
- Workshop-wise pricing (read-only)
- Extra work pricing (if approved)

### D. Mechanic Progress (Supervisor Review Panel)

Supervisor can check:

- ✅ Before images uploaded?
- ✅ Progress images?
- ✅ After images?
- ✅ Checklist completion status
- ✅ Comments/mechanic notes
- ✅ Parts consumed

**Supervisor can approve/reject each stage.**

### E. Extra Work Approval (IMPORTANT)

Mechanic submits extra work request with:

- Image
- Description
- Cost estimate

**Supervisor can:**

- ✅ Approve
- ✅ Reject
- ✅ Ask for more images
- ✅ Reassign part usage decision

**System auto logs approval/rejection event.**

### F. QC Section (Quality Check)

Supervisor ensures:

- Work completed properly
- All checklists are correct
- No pending parts
- No missing media
- No customer complaint

**Supervisor marks:**

- ✅ **QC PASSED** → Job ready for delivery
- ❌ **QC FAILED** → Send back to mechanic

### G. Pickup / Drop Management (If applicable)

Supervisor monitors:

- Pickup assigned
- Pickup boy
- Pickup OTP
- Pickup images
- Vehicle dropped time

**Supervisor can:**

- Reassign pickup
- Change pickup status

### H. Communication Section

Supervisor can:

- Chat with mechanic
- Chat with admin
- Leave internal notes
- Add QC comments
- Add delivery notes

**All chats logged in `lead_activities`.**

---

## 5. Workflow (Supervisor Control)

### 1. Job Assigned (Admin → Supervisor)

- Supervisor reviews → Assigns mechanic.

### 2. Job In Progress

Supervisor ensures:

- Before images uploaded
- Correct parts used
- Mechanic following SOP

### 3. Extra Work Stage

Supervisor receives extra work request:

- Review image
- Validate reason
- Approve or reject

### 4. Job Completion (Mechanic → Supervisor)

Mechanic marks job completed.

**Supervisor checks:**

- Checklist
- After images
- Parts usage
- Service quality

**If OK** → QC PASSED  
**If not** → Returned to mechanic with notes.

### 5. Delivery Stage

Supervisor confirms:

- Car cleaned
- All work done
- Final billing ready

**Supervisor marks:**

- **READY_FOR_DELIVERY**

---

## 6. Supervisor Permissions (RBAC)

### ✅ Supervisor CAN:

- View all leads
- View all mechanics and jobs
- Assign mechanic (if enabled)
- Reassign job
- Approve/reject extra work
- Approve images
- Complete QC
- Update job status (HOLD, BACK_TO_MECHANIC)
- Mark READY_FOR_DELIVERY
- Add internal notes
- Chat with mechanic/admin

### ❌ Supervisor CANNOT:

- Accept/reject leads
- Change workshop assignment
- Change pricing
- Generate invoices
- Edit services or add-ons
- View full customer mobile (optional permission toggle)
- Close job (Admin-only)
- Approve payments

**Supervisor is operations controller, not admin.**

---

## 7. Supervisor KPIs (Performance Dashboard)

Supervisor performance is tracked through analytics:

- ✅ Daily job throughput
- ✅ Average QC time
- ✅ Number of reworks
- ✅ SLA breach count
- ✅ Mechanic efficiency report
- ✅ Extra work approval turnaround time
- ✅ Customer rating influence
- ✅ Job returns / complaint percentage

**These metrics help Admin judge supervisor efficiency.**

---

## 8. API Endpoints for Supervisor

### Get all jobs for supervisor

```
GET /api/supervisor/{id}/jobs
```

### Assign/Reassign Mechanic

```
POST /api/leads/{lead_id}/assign-mechanic
```

### Approve/Reject Extra Work

```
POST /api/leads/{lead_id}/extra-work/approve
POST /api/leads/{lead_id}/extra-work/reject
```

### Mark QC Passed / Failed

```
POST /api/leads/{lead_id}/qc-status
```

### Mark READY_FOR_DELIVERY

```
POST /api/leads/{lead_id}/ready-for-delivery
```

### Upload QC images

```
POST /api/leads/{lead_id}/supervisor/media
```

### Chat / notes

```
POST /api/leads/{lead_id}/notes
```

**All APIs require JWT + role = SUPERVISOR.**

---

## 9. UI/UX Requirements for Supervisor Panel

- ✅ Multi-tab structure for job stages
- ✅ Status color indicators
- ✅ One-tap "Approve" or "Reject" buttons
- ✅ Image preview with zoom
- ✅ Large checklists
- ✅ Mechanic performance shortcut
- ✅ SLA countdown highlights
- ✅ Easy reassignment menu

**Supervisor UI must be monitoring-focused, not heavy editing UI.**

---

## 10. Example Supervisor Workflow (Realistic Scenario)

### Step 1: Admin accepts lead → assigned to workshop

- Supervisor sees job.

### Step 2: Supervisor assigns Mechanic Rahul

- Mechanic starts job.

### Step 3: Mechanic uploads before images

- Supervisor checks.

### Step 4: Mechanic finds bad brake pads → requests extra work

- Supervisor verifies → approves with comment.

### Step 5: Mechanic completes repair

- Uploads after photos → marks complete.

### Step 6: Supervisor performs QC

- Checklist & images verified → QC PASSED.

### Step 7: Supervisor marks READY_FOR_DELIVERY

- Pickup boy/customer informed.

---

## 11. Database Requirements

### New Tables

#### `qc_checks`

```sql
- id
- lead_id
- supervisor_id
- qc_status (PENDING, PASSED, FAILED)
- checklist_data (JSONB)
- images_verified (BOOLEAN)
- parts_verified (BOOLEAN)
- mechanic_notes_approved (BOOLEAN)
- supervisor_notes
- failed_reason
- created_at
- updated_at
```

#### `mechanic_assignments`

```sql
- id
- lead_id
- mechanic_id
- assigned_by (supervisor_id)
- assigned_at
- reassigned_from (mechanic_id, nullable)
- reassignment_reason
- status (ACTIVE, REASSIGNED, COMPLETED)
```

#### `supervisor_actions`

```sql
- id
- lead_id
- supervisor_id
- action_type (ASSIGN, REASSIGN, APPROVE_EXTRA_WORK, REJECT_EXTRA_WORK, QC_PASS, QC_FAIL, MARK_READY)
- action_data (JSONB)
- notes
- created_at
```

### Enhance Existing Tables

#### `service_leads`

Add columns:

```sql
- qc_status (PENDING, PASSED, FAILED)
- qc_performed_by (supervisor_id)
- qc_performed_at
- ready_for_delivery_at
- marked_ready_by (supervisor_id)
```

#### `lead_extra_charges`

Add columns:

```sql
- supervisor_approved_by
- supervisor_approval_notes
- approval_requested_at
- approval_responded_at
```

---

## Development Priority

### Phase 1: Core Supervisor Features (Week 1-2)

1. ✅ Supervisor dashboard with widgets
2. ✅ Job list view with filters
3. ✅ Basic job detail page
4. ✅ Mechanic assignment/reassignment
5. ✅ Database schema enhancements

### Phase 2: QC & Approvals (Week 3-4)

1. ✅ Extra work approval system
2. ✅ QC checklist implementation
3. ✅ Image verification
4. ✅ Mark READY_FOR_DELIVERY
5. ✅ Supervisor notes/comments

### Phase 3: Analytics & Mobile (Week 5-6)

1. ✅ Supervisor KPI dashboard
2. ✅ Mechanic performance tracking
3. ✅ Mobile app supervisor screens
4. ✅ Real-time notifications
5. ✅ Reporting

---

**Document Version:** 1.0  
**Last Updated:** November 17, 2025  
**Status:** Master Reference Document for Development

