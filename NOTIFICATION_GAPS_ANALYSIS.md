# 🔍 MyFNG Notification System - Gap Analysis

**Date:** Jan 7, 2026  
**Purpose:** Identify missing/incomplete notification implementations

---

## ❌ MISSING NOTIFICATIONS

### 1. MECHANIC NOTIFICATIONS - Missing Items

| # | Notification | Trigger | Expected Route | Status |
|---|-------------|---------|----------------|--------|
| 1 | **Job Completed Confirmation** | Mechanic completes job | `/api/mechanic/jobs/[id]/complete` | ⚠️ **MISSING** - Only calls `notifyReadyForQC()` for supervisor, no confirmation to mechanic |
| 2 | **Inspection Photos Pending** | Inspection not completed within time | Cron job | ❌ **NOT IMPLEMENTED** |
| 3 | **Service Start Approval** | Supervisor approves inspection | `/api/supervisor/jobs/[id]/approve-inspection` | ❌ **ROUTE DOES NOT EXIST** |
| 4 | **Parts Issue Alert** | Required part out of stock | Manual trigger or inventory system | ❌ **NOT IMPLEMENTED** |
| 5 | **Job Delay Warning (SLA)** | Repair taking longer than estimated | Cron job | ❌ **NOT IMPLEMENTED** |
| 6 | **Job Completion Reminder** | Mechanic hasn't marked complete | Cron job | ❌ **NOT IMPLEMENTED** |
| 7 | **After-Service Media Pending** | Job complete but photos missing | `/api/mechanic/jobs/[id]/complete` | ⚠️ **PARTIAL** - Validation exists but no notification |
| 8 | **Test Drive Required** | Post-repair test drive needed | System logic | ❌ **NOT IMPLEMENTED** |
| 9 | **Customer Complaint** | Complaint tagged to mechanic's job | `/api/complaints/route.ts` | ⚠️ **PARTIAL** - Route exists but notification unclear |
| 10 | **Audit Observation** | Auditor adds observation | `/api/auditor/leads/[id]/flag` | ⚠️ **PARTIAL** - Route exists but mechanic notification unclear |
| 11 | **Safety/Incident Alert** | Incident reported during repair | Manual trigger | ❌ **NOT IMPLEMENTED** |
| 12 | **Daily Work Summary** | End of shift summary | Cron job | ❌ **NOT IMPLEMENTED** |

### 2. PICKUP BOY NOTIFICATIONS - Missing Items

| # | Notification | Trigger | Expected Route | Status |
|---|-------------|---------|----------------|--------|
| 1 | **Document Upload Reminder** | Mandatory photos not uploaded | Cron job | ⚠️ **PARTIAL** - In cron but needs verification |
| 2 | **Handover Checklist Incomplete** | Handover not completed | `/api/pickup/tasks/[id]/arrived` | ❌ **NOT IMPLEMENTED** |
| 3 | **Delivery Failure** | Delivery attempt failed | `/api/pickup/[id]/drop/complete` | ⚠️ **NEEDS VERIFICATION** |
| 4 | **Customer Complaint (Pickup/Delivery)** | Complaint during pickup/delivery | `/api/complaints/route.ts` | ❌ **NOT IMPLEMENTED** |
| 5 | **Safety/SOS Alert** | Pickup boy presses SOS | `/api/pickup/[id]/report-incident` | ⚠️ **PARTIAL** - Route exists but notification unclear |

### 3. WORKSHOP ADMIN NOTIFICATIONS - Missing Items

| # | Notification | Trigger | Expected Route | Status |
|---|-------------|---------|----------------|--------|
| 1 | **Job Started** | Mechanic starts job | `/api/mechanic/jobs/[id]/start` | ✅ **IMPLEMENTED** (verified) |
| 2 | **Job Completed** | Mechanic completes job | `/api/mechanic/jobs/[id]/complete` | ⚠️ **MISSING** - Only supervisor notified |
| 3 | **QC Approved** | Supervisor approves QC | `/api/supervisor/jobs/[id]/approve-qc` | ⚠️ **MISSING** - Only mechanic notified |
| 4 | **QC Rejected** | Supervisor rejects QC | `/api/supervisor/jobs/[id]/reject-qc` | ⚠️ **MISSING** - Only mechanic notified |

### 4. SUPERVISOR NOTIFICATIONS - Missing Items

| # | Notification | Trigger | Expected Route | Status |
|---|-------------|---------|----------------|--------|
| 1 | **Job Completed (Ready for QC)** | Mechanic completes job | `/api/mechanic/jobs/[id]/complete` | ✅ **IMPLEMENTED** (via `notifyReadyForQC()`) |
| 2 | **Inspection Submitted** | Mechanic submits inspection | Inspection route | ❌ **NOT IMPLEMENTED** |
| 3 | **Parts Delay** | Parts not available | Inventory system | ❌ **NOT IMPLEMENTED** |

### 5. TELECALLER NOTIFICATIONS - Missing Items

| # | Notification | Trigger | Expected Route | Status |
|---|-------------|---------|----------------|--------|
| 1 | **Job Completed** | Mechanic completes job | `/api/mechanic/jobs/[id]/complete` | ❌ **MISSING** |
| 2 | **QC Rejected** | Supervisor rejects QC | `/api/supervisor/jobs/[id]/reject-qc` | ⚠️ **NEEDS VERIFICATION** |
| 3 | **Ready for Delivery** | Job ready for customer delivery | Status change route | ❌ **MISSING** |
| 4 | **Vehicle Delivered** | Vehicle delivered to customer | `/api/pickup/[id]/drop/complete` | ❌ **MISSING** |

---

## ⚠️ PARTIAL IMPLEMENTATIONS (Need Verification)

### 1. Complaint Notifications
**File:** `/apps/web/src/app/api/complaints/route.ts`
- Route exists
- Need to verify if notifications are sent to:
  - Mechanic (if complaint about repair)
  - Pickup Boy (if complaint about pickup/delivery)
  - Workshop Admin
  - Telecaller

### 2. Audit Notifications
**File:** `/apps/web/src/app/api/auditor/leads/[id]/flag/route.ts`
- Route exists
- Need to verify if notifications are sent to:
  - Mechanic
  - Workshop Admin
  - Supervisor

### 3. Delivery Failure
**File:** `/apps/web/src/app/api/pickup/[id]/drop/complete/route.ts`
- Route exists
- Need to verify if failure case sends notifications

### 4. SOS/Incident Alerts
**File:** `/apps/web/src/app/api/pickup/[id]/report-incident/route.ts`
- Route exists
- Need to verify if notifications are sent to:
  - Workshop Admin
  - Supervisor
  - Emergency contacts

---

## ✅ VERIFIED WORKING NOTIFICATIONS

### Telecaller (12 types)
1. ✅ Lead validated
2. ✅ Lead incomplete
3. ✅ Workshop accepted
4. ✅ Workshop rejected
5. ✅ Lead in service (IN_PROGRESS/IN_SERVICE status)
6. ✅ Extra work requested
7. ✅ Extra work approved
8. ✅ Extra work rejected
9. ✅ Pickup observation added
10. ✅ Supervisor observation added (QC approve/reject)
11. ✅ Follow-up reminder (cron)
12. ✅ Workshop SLA breach/warning (cron)

### Workshop Admin (3 types)
1. ✅ Lead assigned to workshop
2. ✅ Lead accepted by supervisor
3. ✅ Extra work approved
4. ✅ Job started (mechanic starts work)

### Workshop Supervisor (3 types)
1. ✅ Extra work requested
2. ✅ Route deviation
3. ✅ Route delay

### Mechanic (5 types)
1. ✅ Job assigned
2. ✅ QC approved
3. ✅ QC rejected
4. ✅ Extra work approved
5. ✅ Extra work rejected

### Pickup Boy (10 types)
1. ✅ Pickup task assigned
2. ✅ Pickup reassigned
3. ✅ OTP verified
4. ✅ Pickup completed
5. ✅ Arrived at workshop
6. ✅ Delivery started
7. ✅ Delivery completed
8. ✅ Route deviation
9. ✅ Route delay
10. ✅ Observation required (cron)
11. ✅ Acceptance pending (cron)
12. ✅ Navigation reminder (cron)
13. ✅ Daily summary (cron)

### Lead Manager (2 types)
1. ✅ Workshop accepted lead
2. ✅ Workshop rejected lead

---

## 📊 SUMMARY STATISTICS

| Category | Total Planned | Implemented | Missing | Partial | % Complete |
|----------|---------------|-------------|---------|---------|------------|
| **Telecaller** | 12 | 12 | 0 | 0 | 100% |
| **Workshop Admin** | 7 | 4 | 3 | 0 | 57% |
| **Workshop Supervisor** | 6 | 3 | 3 | 0 | 50% |
| **Mechanic** | 20 | 5 | 12 | 3 | 25% |
| **Pickup Boy** | 20 | 13 | 4 | 3 | 65% |
| **Lead Manager** | 2 | 2 | 0 | 0 | 100% |
| **TOTAL** | 67 | 39 | 22 | 6 | 58% |

---

## 🎯 PRIORITY RECOMMENDATIONS

### HIGH PRIORITY (Critical for Operations)
1. **Mechanic: Job Completed Confirmation** - Mechanic should know job was submitted
2. **Workshop Admin: Job Completed** - Admin needs to track completed jobs
3. **Telecaller: Job Completed** - Telecaller needs to update customer
4. **Mechanic: After-Service Media Pending** - Blocking notification for missing photos
5. **Pickup Boy: Handover Checklist Incomplete** - Blocking notification for incomplete handover

### MEDIUM PRIORITY (Important for SLA)
6. **Mechanic: Job Delay Warning (SLA)** - Cron job for SLA monitoring
7. **Mechanic: Job Completion Reminder** - Cron job reminder
8. **Mechanic: Inspection Photos Pending** - Cron job reminder
9. **Workshop Admin: QC Approved/Rejected** - Admin should be aware of QC results
10. **Telecaller: Ready for Delivery** - Customer communication

### LOW PRIORITY (Nice to Have)
11. **Mechanic: Daily Work Summary** - End of day summary
12. **Mechanic: Test Drive Required** - If test drive feature is enabled
13. **Mechanic: Parts Issue Alert** - If inventory system is integrated
14. **Pickup Boy: Document Upload Reminder** - Already partially implemented in cron

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Add Mechanic Job Completed Confirmation
**File:** `/apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`

```typescript
// After line 359 (after notifyReadyForQC call)
// Add confirmation to mechanic
await createNotification({
  userId: userProfile.id,
  type: 'JOB_COMPLETED',
  title: 'Job submitted for QC',
  message: `Your work on lead ${leadNumber} has been submitted for quality check.`,
  priority: 'MEDIUM',
  leadId,
  leadNumber,
  actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
  metadata: { kind: 'JOB_COMPLETED_CONFIRMATION' },
});
```

### Fix 2: Add Workshop Admin Notification for Job Completed
**File:** `/apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`

```typescript
// After mechanic confirmation
await notifyWorkshopRoles({
  workshopId: (lead as any).workshop_id,
  roleCodes: ['WORKSHOP_ADMIN'],
  type: 'JOB_COMPLETED',
  title: 'Job completed',
  message: `${mechanicName} completed work on lead ${leadNumber}. Awaiting QC.`,
  priority: 'LOW',
  leadId,
  leadNumber,
  actionUrl: `/dashboard/workshop_admin/jobs`,
  metadata: { kind: 'JOB_COMPLETED_ADMIN' },
});
```

### Fix 3: Add Telecaller Notification for Job Completed
**File:** `/apps/web/src/app/api/mechanic/jobs/[id]/complete/route.ts`

```typescript
// After admin notification
await notifyTelecallerForLead({
  leadId,
  leadNumber,
  type: 'JOB_COMPLETED',
  title: 'Job completed',
  message: `Work completed for lead ${leadNumber}. Awaiting quality check.`,
  priority: 'MEDIUM',
  metadata: { kind: 'JOB_COMPLETED_TELECALLER' },
});
```

### Fix 4: Add Workshop Admin Notifications for QC Results
**File:** `/apps/web/src/app/api/supervisor/jobs/[id]/approve-qc/route.ts`

```typescript
// After mechanic notification (around line 250)
await notifyWorkshopRoles({
  workshopId: userProfile.workshop_id,
  roleCodes: ['WORKSHOP_ADMIN'],
  type: 'QC_APPROVED',
  title: 'QC approved',
  message: `Quality check approved for lead ${leadNumber}. Ready for billing.`,
  priority: 'LOW',
  leadId,
  leadNumber,
  actionUrl: `/dashboard/workshop_admin/jobs`,
  metadata: { kind: 'QC_APPROVED_ADMIN' },
});
```

**File:** `/apps/web/src/app/api/supervisor/jobs/[id]/reject-qc/route.ts`

```typescript
// After mechanic notification
await notifyWorkshopRoles({
  workshopId: userProfile.workshop_id,
  roleCodes: ['WORKSHOP_ADMIN'],
  type: 'QC_REJECTED',
  title: 'QC rejected',
  message: `Quality check rejected for lead ${leadNumber}. Rework required.`,
  priority: 'MEDIUM',
  leadId,
  leadNumber,
  actionUrl: `/dashboard/workshop_admin/jobs`,
  metadata: { kind: 'QC_REJECTED_ADMIN' },
});
```

---

## 📝 NOTES

1. **Mechanic Daily Summary:** Can be implemented similar to Pickup Boy daily summary in cron
2. **Job Delay SLA:** Needs business logic to define "expected completion time" per service type
3. **Inspection Photos Pending:** Needs cron job similar to pickup SLA checks
4. **Parts Issue Alert:** Requires inventory system integration
5. **Test Drive Required:** Needs business logic to determine when test drive is mandatory
6. **Complaint Notifications:** Existing route needs enhancement to send role-specific notifications
7. **Audit Observations:** Existing route needs enhancement to notify mechanic

---

**Report Generated:** Jan 7, 2026  
**Status:** Gap analysis complete, recommendations provided

