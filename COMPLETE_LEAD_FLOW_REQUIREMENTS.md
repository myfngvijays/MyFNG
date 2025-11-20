# 🚀 Complete Lead Flow - End-to-End Requirements

## Overview
Complete flow from lead creation to closure, covering all roles and stages.

---

## 🟦 STEP 1 — Lead Creation (Status: NEW)

**Trigger:** Telecaller/Any source adds lead

**Auto Actions:**
- ✅ Lead saved in database
- ✅ Status auto-set: `NEW`
- ✅ SLA timer starts (20 minutes for Lead Manager)
- ✅ Event emitted: `lead_new_created`
- ✅ Lead appears in Lead Manager dashboard

**Database Fields Set:**
```sql
status = 'NEW'
created_by_id = telecaller_id
created_at = NOW()
sla_state = 'ON_TIME'
sla_expires_at = NOW() + 20 minutes
```

---

## 🟧 STEP 2 — Lead Manager Validation

**Who:** Lead Manager
**Dashboard:** Lead Manager Control Panel

**Tasks:**
1. ✅ Validate customer details
2. ✅ Validate vehicle details
3. ✅ Check address & pickup correctness
4. ✅ Verify service types & addons
5. ✅ Check pricing availability
6. ✅ Duplicate leads check
7. ✅ Workshop availability check

**Actions Available:**
- ✏️ Edit lead details
- ✏️ Correct missing/wrong information
- 🔀 Merge duplicate leads
- 🚫 Mark as Fraud/Spam
- 📞 Contact customer if needed

**Next Step:**
- Assign workshop based on criteria

---

## 🟩 STEP 3 — Workshop Assignment

**Who:** Lead Manager
**Action:** Assign Workshop

**Assignment Criteria:**
1. ✅ Customer location (lat/lng)
2. ✅ City/Zone match
3. ✅ Car model compatibility
4. ✅ Workshop ratings
5. ✅ Price availability
6. ✅ Distance from customer
7. ✅ Slot availability
8. ✅ Workshop capacity

**When Assigned:**
```sql
assigned_workshop_id = workshop.id
status = 'ASSIGNED_TO_WORKSHOP'
assigned_at = NOW()
assigned_by = lead_manager_id
sla_accept_deadline = NOW() + workshop_sla_time
```

**Notifications:**
- 🔔 Workshop Admin gets instant notification
- ⏰ SLA timer for Workshop Admin starts

---

## 🟥 STEP 4 — Workshop Admin Decision

**Who:** Workshop Admin
**Dashboard:** Workshop Admin Dashboard

**Options:**

### A. Accept Lead ✅
```sql
status = 'ACCEPTED'
accepted_at = NOW()
accepted_by = workshop_admin_id
```
**Next:** Job card created → Assign team

### B. Reject Lead ❌
**Must choose reason:**
- 🔴 Busy/No capacity
- 🔴 Wrong address
- 🔴 Low load capacity
- 🔴 Car model not supported
- 🔴 Price too low
- 🔴 Other reason

```sql
status = 'REJECTED'
rejected_at = NOW()
rejected_by = workshop_admin_id
rejected_reason = 'reason_code'
rejection_notes = 'detailed reason'
```
**Next:** Lead goes back to Lead Manager → Reassign

---

## 🟦 STEP 5 — Team Assignment

**Who:** Workshop Admin
**After:** Lead accepted

**Assign:**
1. **Mechanic** → `assigned_mechanic_id`
2. **Supervisor** → `assigned_supervisor_id`
3. **Pickup Boy** → `assigned_pickup_id` (if pickup required)

**Pickup Boy Receives:**
- 📍 Customer info
- 📍 Pickup location (GPS)
- 🔐 OTP for verification
- 🚗 Vehicle details
- 📞 Customer contact

**Mechanic Receives:**
- 🔧 Service details
- 📋 Job instructions
- 🖼️ Before images (from pickup)
- ⏰ SLA deadline
- 📝 Special notes

**Status Update:**
```sql
status = 'TEAM_ASSIGNED'
mechanic_assigned_at = NOW()
pickup_assigned_at = NOW()
supervisor_assigned_at = NOW()
```

---

## 🟧 STEP 6 — Pickup & Job Start

### If Pickup Required:

**Pickup Boy Flow:**
1. 📍 Visit customer location
2. 🔐 Verify OTP → `pickup_status = 'VERIFIED'`
3. 📸 Upload BEFORE images (all angles)
4. 🚗 Drive car to workshop
5. ✅ Mark delivered → `pickup_status = 'DELIVERED'`

**Status Updates:**
```sql
pickup_status = 'IN_TRANSIT' → 'DELIVERED'
status = 'READY_FOR_SERVICE'
```

### If No Pickup:

**Customer Arrives:**
- 🚗 Customer brings car to workshop
- 📸 Before images taken
- ✅ Job begins immediately

**Mechanic Starts:**
```sql
status = 'IN_PROGRESS'
started_at = NOW()
```
- 📸 Upload during-service images
- 🔧 Perform service work
- 💰 Request extra charges (if needed)

---

## 🟩 STEP 7 — Service & Supervision

### Mechanic Work:
1. ✅ Before images (if not from pickup)
2. 🔧 Service work as per job card
3. 💰 Extra work request (with reason + estimate)
4. 📸 During-service images
5. 📸 After images (all angles)
6. ✅ Mark job complete

**Extra Work Request:**
```sql
INSERT INTO mechanic_extra_work_requests (
  mechanic_id,
  lead_id,
  description,
  estimated_cost,
  status = 'PENDING'
)
```

### Supervisor Verifies:
1. ✅ Work quality check
2. ✅ Images verification
3. ✅ Parts used validation
4. ✅ Extra charges validity
5. ✅ Customer communication
6. ✅ Approve/Reject extra work

**Status Update:**
```sql
status = 'QC_PENDING'
qc_status = 'PENDING'
```

---

## 🟥 STEP 8 — Auditor Verification (If Required)

**Trigger:** High-value jobs, random audits, escalations

**Who:** Auditor (Sub Admin or dedicated auditor)

**Checks:**
1. ✅ Job completion quality
2. ✅ Images authenticity
3. ✅ Extra charges validity
4. ✅ Customer satisfaction
5. ✅ Workshop compliance
6. ✅ SLA adherence

**Actions:**
```sql
audit_required = true
audit_status = 'PENDING' → 'APPROVED' / 'FLAGGED'
audit_performed_by = auditor_id
audit_performed_at = NOW()
audit_notes = 'detailed feedback'
workshop_score = 85 (out of 100)
```

**If Issues Found:**
- 🚨 Escalate to Workshop Admin
- 🚨 Escalate to Sub Admin
- 🚨 Escalate to Super Admin

**Outcome:**
- ✅ Approved → Proceed to billing
- 🚫 Flagged → Workshop penalty / Re-work

---

## 🟦 STEP 9 — Billing & Invoice Generation

**Who:** Billing Team / Auto-system

**Process:**
1. 📋 Fetch job card details
2. 💰 Calculate base charges (from service_types)
3. 💰 Add extra charges (approved)
4. 💰 Apply taxes (GST/VAT)
5. 💰 Apply workshop/service prices
6. 💰 Apply coupon discounts
7. 📄 Generate invoice PDF

**Invoice Sent To:**
- 📱 Customer (WhatsApp/SMS/Email)
- 🏪 Workshop Admin (email/dashboard)

**Database:**
```sql
INSERT INTO invoices (
  lead_id,
  workshop_id,
  invoice_number,
  base_amount,
  extra_charges,
  tax_amount,
  discount_amount,
  final_amount,
  status = 'GENERATED'
)

UPDATE service_leads SET
  invoice_id = new_invoice.id,
  invoice_amount = final_amount,
  status = 'AWAITING_PAYMENT'
```

---

## 🟧 STEP 10 — Payment by Customer

**Payment Methods:**
- 💳 Online (UPI/Credit/Debit)
- 📱 In-app payment gateway
- 💵 Cash (at workshop)
- 👛 Wallet/Credits

**Payment Flow:**
```sql
UPDATE invoices SET
  payment_status = 'PAID',
  payment_mode = 'UPI',
  payment_txn_id = 'TXN123456',
  paid_at = NOW()

UPDATE service_leads SET
  payment_status = 'PAID',
  status = 'PAYMENT_COMPLETED'
```

**Auto Actions:**
- 📧 Receipt sent to customer
- 💰 Workshop payout queued
- ⭐ Rating request sent to customer

---

## 🟩 STEP 11 — CSE Follow-Up

**Who:** Customer Service Executive (CSE)

**Tasks:**
1. 📞 Call customer (24 hours after completion)
2. ✅ Confirm satisfaction
3. 🎧 Solve pending issues
4. ⭐ Request rating/feedback
5. ✅ Close ticket

**If Customer Happy:**
```sql
UPDATE service_leads SET
  status = 'COMPLETED',
  completed_at = NOW(),
  customer_feedback = 'positive'
```

**If Customer Unhappy:**
- 🚨 CSE escalates to Sub Admin
- 🚨 Workshop penalty possible
- 🚨 Refund/Re-work initiated

---

## 🟥 STEP 12 — Lead CLOSED (Final)

**System Completes Lead:**

**Final Database State:**
```sql
UPDATE service_leads SET
  status = 'CLOSED',
  closed_at = NOW(),
  closed_by = cse_id OR system

Final Checklist:
✅ Invoice generated & paid
✅ Job history saved
✅ All images stored (S3/CDN)
✅ Workshop payout pending
✅ Customer rating collected
✅ All logs saved in lead_status_history
✅ SLA score calculated
✅ Workshop performance updated
```

**Archive:**
- 📦 Move to completed_leads (archive table)
- 📊 Update analytics/reports
- 💰 Queue workshop payout

---

## 🔄 COMPLETE FLOW SUMMARY

### Linear Flow:
```
Telecaller → NEW
    ↓
Lead Manager → VALIDATED → ASSIGNED_TO_WORKSHOP
    ↓
Workshop Admin → ACCEPTED (or REJECTED → back to Lead Manager)
    ↓
Team Assignment → TEAM_ASSIGNED
    ↓
Pickup Boy → IN_TRANSIT → DELIVERED
    ↓
Mechanic → IN_PROGRESS → WORK_COMPLETED
    ↓
Supervisor → QC_PENDING → QC_APPROVED
    ↓
Auditor (if needed) → AUDIT_APPROVED
    ↓
Billing → INVOICE_GENERATED → AWAITING_PAYMENT
    ↓
Customer → PAYMENT_COMPLETED
    ↓
CSE → COMPLETED
    ↓
System → CLOSED
```

---

## 📊 Status States List

**All Possible Statuses:**
1. `NEW` - Just created
2. `INCOMPLETE` - Missing info
3. `VALIDATED` - Lead Manager approved
4. `ASSIGNED_TO_WORKSHOP` - Workshop assigned
5. `PENDING_ACCEPTANCE` - Waiting for workshop
6. `ACCEPTED` - Workshop accepted
7. `REJECTED` - Workshop rejected
8. `TEAM_ASSIGNED` - Mechanic/Supervisor assigned
9. `PICKUP_SCHEDULED` - Pickup boy assigned
10. `IN_TRANSIT` - Vehicle being picked up
11. `DELIVERED` - Vehicle at workshop
12. `IN_PROGRESS` - Service ongoing
13. `WORK_COMPLETED` - Mechanic finished
14. `QC_PENDING` - Awaiting supervisor check
15. `QC_APPROVED` - QC passed
16. `AUDIT_PENDING` - Awaiting auditor
17. `AUDIT_APPROVED` - Audit passed
18. `INVOICE_GENERATED` - Billing done
19. `AWAITING_PAYMENT` - Waiting for customer payment
20. `PAYMENT_COMPLETED` - Customer paid
21. `COMPLETED` - Service finished
22. `CLOSED` - Fully closed
23. `CANCELLED` - Cancelled by customer/system
24. `ESCALATED` - Issue escalated

---

## 🔐 Role-Based Permissions

| Role | Can View | Can Edit | Can Assign | Can Close |
|------|----------|----------|------------|-----------|
| Telecaller | Own leads | Own leads (NEW only) | ❌ | ❌ |
| Lead Manager | All leads | All leads | Workshops | ❌ |
| Workshop Admin | Workshop leads | Workshop leads | Team members | ❌ |
| Mechanic | Assigned jobs | Job updates | ❌ | ❌ |
| Supervisor | Workshop jobs | QC status | Mechanics | ❌ |
| Pickup Boy | Assigned pickups | Pickup status | ❌ | ❌ |
| Auditor | Flagged leads | Audit status | ❌ | ❌ |
| CSE | Completed leads | Feedback | ❌ | ✅ |
| Sub Admin | All leads | All leads | All | ✅ |
| Super Admin | All leads | All leads | All | ✅ |

---

## 🎯 SLA Timelines

| Stage | SLA Time | Owner | Penalty |
|-------|----------|-------|---------|
| NEW → VALIDATED | 20 min | Lead Manager | Alert to Sub Admin |
| ASSIGNED → ACCEPTED | 30 min | Workshop Admin | Auto-reassign |
| ACCEPTED → TEAM_ASSIGNED | 15 min | Workshop Admin | Rating deduction |
| PICKUP_SCHEDULED → IN_TRANSIT | 2 hours | Pickup Boy | Performance score |
| IN_PROGRESS → WORK_COMPLETED | Job-specific | Mechanic | Efficiency score |
| QC_PENDING → QC_APPROVED | 30 min | Supervisor | Alert |
| INVOICE_GENERATED → PAYMENT | 24 hours | Customer | Reminder |

---

## 📱 Notifications Required

**Real-time Notifications:**
- 🔔 Lead Manager: New lead created
- 🔔 Workshop Admin: Lead assigned
- 🔔 Mechanic: Job assigned
- 🔔 Pickup Boy: Pickup assigned
- 🔔 Supervisor: QC pending
- 🔔 Customer: Status updates (SMS/WhatsApp)
- 🔔 Billing: Payment received
- 🔔 Workshop: Payout processed

---

## 📈 Analytics & Reporting

**Track:**
- Lead conversion rate
- SLA adherence per role
- Workshop acceptance rate
- Average service time
- Customer satisfaction score
- Workshop performance score
- Revenue per lead
- Cost per lead

---

**Status:** 📋 Requirements Document  
**Next:** Implementation Plan  
**Date:** November 20, 2025

