# 🚀 WORKSHOP SUPERVISOR - COMPREHENSIVE DEVELOPMENT PLAN

**Based on:** WORKSHOP_SUPERVISOR_COMPLETE_FUNCTIONALITY.md  
**Created:** November 17, 2025  
**Status:** Master Development Plan

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Phase 1: Core Supervisor Features](#phase-1-core-supervisor-features-week-1-2)
4. [Phase 2: QC & Approvals](#phase-2-qc--approvals-week-3-4)
5. [Phase 3: Analytics & Mobile](#phase-3-analytics--mobile-week-5-6)
6. [Database Schema Changes](#database-schema-changes)
7. [API Endpoints Implementation](#api-endpoints-implementation)
8. [UI/UX Components](#uiux-components)
9. [Testing Strategy](#testing-strategy)
10. [Timeline & Resource Allocation](#timeline--resource-allocation)

---

## Executive Summary

### Project Overview

Complete implementation of **Workshop Supervisor** functionality for MyFNG platform, enabling supervisors to manage mechanics, oversee job progress, perform quality control, and ensure smooth operations.

### Key Objectives

- ✅ Operational dashboard with real-time metrics
- ✅ Mechanic assignment and reassignment system
- ✅ Quality Control (QC) checklist and verification
- ✅ Extra work approval workflow
- ✅ Image verification system
- ✅ Performance tracking and KPIs
- ✅ Communication bridge (Admin ↔ Supervisor ↔ Mechanic)

### Estimated Timeline

- **Phase 1 (Core Features):** 2 weeks
- **Phase 2 (QC & Approvals):** 2 weeks
- **Phase 3 (Analytics & Mobile):** 2 weeks
- **Total:** 6 weeks

---

## Current State Analysis

### ✅ Already Implemented

1. **Basic Dashboard:**
   - `/apps/web/src/app/dashboard/workshop_supervisor/page.tsx` (exists)
   - `/apps/mobile/src/screens/dashboard/WorkshopSupervisorDashboard.tsx` (basic version)

2. **Database:**
   - `WORKSHOP_SUPERVISOR` role in `roles` table
   - Basic user permissions
   - `service_leads` table

3. **Navigation:**
   - Dashboard layout includes supervisor menu
   - Mobile navigation supports supervisor role

### ❌ Missing/Needs Enhancement

1. **Dashboard Widgets:**
   - No real-time metrics
   - No quick filters
   - No mechanic performance panel

2. **Job Management:**
   - No mechanic assignment UI
   - No reassignment system
   - No job list view

3. **QC System:**
   - No QC checklist
   - No image verification
   - No QC status tracking

4. **Extra Work Approvals:**
   - No approval workflow
   - No supervisor review panel

5. **Analytics:**
   - No KPI dashboard
   - No performance metrics

---

## Phase 1: Core Supervisor Features (Week 1-2)

### Week 1: Database & Backend Foundation

#### Task WS-101: Database Schema Enhancements ⏱️ 1 day

**Objective:** Add supervisor-specific tables and columns

**New Tables:**

```sql
-- QC Checks Table
CREATE TABLE qc_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES users_login(id),
  qc_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PASSED, FAILED
  checklist_data JSONB,
  images_verified BOOLEAN DEFAULT false,
  parts_verified BOOLEAN DEFAULT false,
  mechanic_notes_approved BOOLEAN DEFAULT false,
  supervisor_notes TEXT,
  failed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mechanic Assignments Table
CREATE TABLE mechanic_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL REFERENCES users_login(id),
  assigned_by UUID NOT NULL REFERENCES users_login(id), -- supervisor_id
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reassigned_from UUID REFERENCES users_login(id), -- previous mechanic
  reassignment_reason TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE' -- ACTIVE, REASSIGNED, COMPLETED
);

-- Supervisor Actions Table
CREATE TABLE supervisor_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES users_login(id),
  action_type VARCHAR(50) NOT NULL, -- ASSIGN, REASSIGN, APPROVE_EXTRA_WORK, etc.
  action_data JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Enhance service_leads:**

```sql
ALTER TABLE service_leads ADD COLUMN:
  - qc_status VARCHAR(20) DEFAULT 'PENDING'
  - qc_performed_by UUID REFERENCES users_login(id)
  - qc_performed_at TIMESTAMP WITH TIME ZONE
  - ready_for_delivery_at TIMESTAMP WITH TIME ZONE
  - marked_ready_by UUID REFERENCES users_login(id)
```

**Enhance lead_extra_charges:**

```sql
ALTER TABLE lead_extra_charges ADD COLUMN:
  - supervisor_approved_by UUID REFERENCES users_login(id)
  - supervisor_approval_notes TEXT
  - approval_requested_at TIMESTAMP WITH TIME ZONE
  - approval_responded_at TIMESTAMP WITH TIME ZONE
```

**Indexes:**

```sql
CREATE INDEX idx_qc_checks_lead_id ON qc_checks(lead_id);
CREATE INDEX idx_qc_checks_supervisor_id ON qc_checks(supervisor_id);
CREATE INDEX idx_mechanic_assignments_lead_id ON mechanic_assignments(lead_id);
CREATE INDEX idx_mechanic_assignments_mechanic_id ON mechanic_assignments(mechanic_id);
CREATE INDEX idx_supervisor_actions_lead_id ON supervisor_actions(lead_id);
CREATE INDEX idx_supervisor_actions_supervisor_id ON supervisor_actions(supervisor_id);
CREATE INDEX idx_service_leads_qc_status ON service_leads(qc_status);
```

**Files to Create:**
- `/database/07_workshop_supervisor_enhancements.sql`

---

#### Task WS-102: Supervisor Dashboard Metrics API ⏱️ 1 day

**Objective:** Create API to fetch dashboard metrics

**Endpoint:** `GET /api/supervisor/dashboard`

**Response:**

```json
{
  "totalJobsToday": 12,
  "assignedJobs": 5,
  "inProgressJobs": 4,
  "jobsOnHold": 1,
  "jobsAwaitingQC": 2,
  "pendingPickups": 3,
  "pendingExtraWorkApprovals": 2,
  "slaAtRiskJobs": 1,
  "mechanics": [
    {
      "id": "uuid",
      "name": "Rahul Kumar",
      "activeJobs": 2,
      "completedToday": 3,
      "efficiency": 85
    }
  ]
}
```

**Files to Create:**
- `/apps/web/src/app/api/supervisor/dashboard/route.ts`

---

#### Task WS-103: Job List API for Supervisor ⏱️ 1 day

**Objective:** Create API to fetch jobs with supervisor-specific details

**Endpoint:** `GET /api/supervisor/jobs?status=ASSIGNED&mechanic_id=xxx`

**Response:**

```json
{
  "jobs": [
    {
      "id": "uuid",
      "lead_number": "LN000145",
      "customer_name": "Amit Sharma",
      "vehicle_number": "MH 01 AB 1234",
      "mechanic": {
        "id": "uuid",
        "name": "Rahul Kumar"
      },
      "status": "IN_PROGRESS",
      "sla_status": "AT_RISK",
      "time_remaining": "25 mins",
      "extra_work_pending": true,
      "images": {
        "before": true,
        "progress": false,
        "after": false
      },
      "pickup_status": "COMPLETED"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

**Files to Create:**
- `/apps/web/src/app/api/supervisor/jobs/route.ts`

---

### Week 2: Frontend Dashboard & Job List

#### Task WS-201: Enhanced Supervisor Dashboard (Web) ⏱️ 2 days

**Objective:** Build operational dashboard with real-time metrics

**Features:**

1. **8 Metric Cards:**
   - Total Jobs Today
   - Assigned Jobs
   - In-Progress Jobs
   - Jobs on Hold
   - Jobs Awaiting QC
   - Pending Pickups
   - Pending Extra Work Approvals
   - SLA At-Risk Jobs

2. **Mechanic Performance Panel:**
   - List of mechanics with active jobs
   - Quick stats per mechanic
   - Click to filter jobs by mechanic

3. **Quick Filters:**
   - ALL | NEW | ACCEPTED | ASSIGNED | IN PROGRESS | HOLD | COMPLETED | READY

4. **Real-time Updates:**
   - Supabase Realtime subscriptions
   - Auto-refresh every 30 seconds

**Files to Create/Update:**
- `/apps/web/src/app/dashboard/workshop_supervisor/page.tsx` (enhance)
- `/apps/web/src/components/supervisor/DashboardMetrics.tsx` (new)
- `/apps/web/src/components/supervisor/MechanicPerformancePanel.tsx` (new)
- `/apps/web/src/components/supervisor/QuickFilters.tsx` (new)

---

#### Task WS-202: Supervisor Job List View ⏱️ 2 days

**Objective:** Create detailed job list with supervisor controls

**Features:**

1. **Job Card Shows:**
   - Lead ID
   - Customer name (masked)
   - Vehicle number
   - Mechanic assigned
   - Service category
   - Current job stage
   - SLA countdown (color-coded)
   - Extra work badge (if pending)
   - Image status indicators (✅ Before, ⚠️ Progress, ❌ After)
   - Pickup status badge

2. **Quick Actions:**
   - View Details
   - Reassign Mechanic
   - Approve Images
   - Approve Extra Work
   - Mark QC Passed
   - Move to HOLD

3. **Filters:**
   - By status
   - By mechanic
   - By service type
   - By SLA status

4. **Search:**
   - Lead ID
   - Customer name
   - Vehicle number

**Files to Create:**
- `/apps/web/src/app/dashboard/workshop_supervisor/jobs/page.tsx`
- `/apps/web/src/components/supervisor/JobCard.tsx`
- `/apps/web/src/components/supervisor/JobFilters.tsx`

---

## Phase 2: QC & Approvals (Week 3-4)

### Week 3: Mechanic Assignment & Extra Work Approval

#### Task WS-301: Mechanic Assignment System ⏱️ 2 days

**Objective:** Implement mechanic assignment and reassignment

**Features:**

1. **Assign Mechanic UI:**
   - Dropdown with available mechanics
   - Shows current workload per mechanic
   - Assignment reason (optional)

2. **Reassign Mechanic UI:**
   - Shows current mechanic
   - Reason required for reassignment
   - Logs reassignment event

3. **API Endpoints:**
   - `POST /api/leads/{id}/assign-mechanic`
   - `POST /api/leads/{id}/reassign-mechanic`

**Files to Create:**
- `/apps/web/src/app/api/leads/[id]/assign-mechanic/route.ts`
- `/apps/web/src/app/api/leads/[id]/reassign-mechanic/route.ts`
- `/apps/web/src/components/supervisor/MechanicAssignmentModal.tsx`
- `/apps/web/src/components/supervisor/ReassignMechanicModal.tsx`

---

#### Task WS-302: Extra Work Approval System ⏱️ 2 days

**Objective:** Build extra work review and approval workflow

**Features:**

1. **Extra Work Request Card:**
   - Description
   - Cost estimate
   - Image(s)
   - Requested by (mechanic)
   - Requested at (timestamp)

2. **Supervisor Actions:**
   - ✅ Approve (with optional notes)
   - ❌ Reject (reason required)
   - 📷 Request more images

3. **Approval Flow:**
   - Request → Supervisor Review → Approve/Reject → Notify Mechanic → Update Lead

4. **API Endpoints:**
   - `POST /api/leads/{id}/extra-work/approve`
   - `POST /api/leads/{id}/extra-work/reject`

**Files to Create:**
- `/apps/web/src/app/api/leads/[id]/extra-work/approve/route.ts`
- `/apps/web/src/app/api/leads/[id]/extra-work/reject/route.ts`
- `/apps/web/src/components/supervisor/ExtraWorkApprovalCard.tsx`
- `/apps/web/src/components/supervisor/ExtraWorkModal.tsx`

---

### Week 4: QC System & Job Detail Page

#### Task WS-401: QC Checklist Implementation ⏱️ 2 days

**Objective:** Build comprehensive QC system

**Features:**

1. **QC Checklist (10 items):**
   - ✅ Before images uploaded
   - ✅ Progress images uploaded
   - ✅ After images uploaded
   - ✅ All parts documented
   - ✅ Service completed as per request
   - ✅ No additional issues found
   - ✅ Car cleaned
   - ✅ Test drive completed
   - ✅ No warning lights
   - ✅ Customer documents ready

2. **QC Actions:**
   - Mark QC PASSED → Job moves to READY_FOR_DELIVERY
   - Mark QC FAILED → Job goes back to mechanic with notes

3. **Image Verification:**
   - View all images (before/progress/after)
   - Zoom functionality
   - Approve/reject individual images

4. **API Endpoints:**
   - `POST /api/leads/{id}/qc-status`
   - `GET /api/leads/{id}/qc-checklist`

**Files to Create:**
- `/apps/web/src/app/api/leads/[id]/qc-status/route.ts`
- `/apps/web/src/components/supervisor/QCChecklist.tsx`
- `/apps/web/src/components/supervisor/ImageVerification.tsx`

---

#### Task WS-402: Supervisor Job Detail Page ⏱️ 2 days

**Objective:** Build comprehensive job detail page for supervisor

**10 Sections:**

1. **Job Summary** (Status, Mechanic, SLA, Timeline)
2. **Customer & Vehicle Info** (Read-only)
3. **Service Package Details** (Services, Add-ons, Pricing)
4. **Mechanic Progress Panel** (Images, Checklist, Parts, Notes)
5. **Extra Work Section** (Pending approvals, History)
6. **QC Section** (Checklist, Pass/Fail actions)
7. **Pickup/Drop Management** (Status, Pickup boy, OTP)
8. **Communication Section** (Notes, Chat)
9. **Action Buttons** (Assign, Reassign, Approve, Mark Ready)
10. **Activity Timeline** (All supervisor actions logged)

**Files to Create:**
- `/apps/web/src/app/dashboard/workshop_supervisor/jobs/[id]/page.tsx`
- `/apps/web/src/components/supervisor/JobSummary.tsx`
- `/apps/web/src/components/supervisor/MechanicProgressPanel.tsx`
- `/apps/web/src/components/supervisor/SupervisorQCSection.tsx`
- `/apps/web/src/components/supervisor/SupervisorCommunication.tsx`

---

## Phase 3: Analytics & Mobile (Week 5-6)

### Week 5: KPI Dashboard & Performance Tracking

#### Task WS-501: Supervisor KPI Dashboard ⏱️ 2 days

**Objective:** Build analytics dashboard for supervisor performance

**Metrics:**

1. **Daily Throughput:**
   - Jobs assigned today
   - Jobs completed today
   - Average completion time

2. **QC Metrics:**
   - Average QC time
   - QC pass rate
   - Number of reworks

3. **SLA Performance:**
   - SLA compliance rate
   - SLA breach count
   - At-risk jobs

4. **Extra Work Metrics:**
   - Approval turnaround time
   - Approval rate
   - Rejected requests

5. **Mechanic Efficiency:**
   - Jobs per mechanic
   - Completion rate per mechanic
   - Rework count per mechanic

6. **Customer Impact:**
   - Customer rating influence
   - Job returns
   - Complaint percentage

**Charts:**
- Pie chart: Job status distribution
- Bar chart: Mechanic performance comparison
- Line chart: Daily job throughput (7 days)
- Line chart: SLA compliance trend (30 days)

**Files to Create:**
- `/apps/web/src/app/dashboard/workshop_supervisor/analytics/page.tsx`
- `/apps/web/src/components/supervisor/KPICards.tsx`
- `/apps/web/src/components/supervisor/PerformanceCharts.tsx`

---

#### Task WS-502: Mechanic Performance Tracking ⏱️ 2 days

**Objective:** Detailed mechanic performance view

**Features:**

1. **Mechanic List:**
   - Name, photo
   - Active jobs
   - Completed today/week/month
   - Efficiency score
   - Average job time
   - Rework count

2. **Individual Mechanic View:**
   - Job history
   - Performance trends
   - Skills/specialization
   - Customer ratings
   - Issue patterns

3. **Comparison View:**
   - Side-by-side mechanic comparison
   - Best/worst performers

**Files to Create:**
- `/apps/web/src/app/dashboard/workshop_supervisor/mechanics/page.tsx`
- `/apps/web/src/components/supervisor/MechanicList.tsx`
- `/apps/web/src/components/supervisor/MechanicDetailView.tsx`

---

### Week 6: Mobile App Integration

#### Task WS-601: Mobile Supervisor Dashboard ⏱️ 2 days

**Objective:** Port supervisor dashboard to mobile

**Features:**
- Dashboard widgets (responsive cards)
- Quick filters
- Job list view
- Real-time updates

**Files to Create/Update:**
- `/apps/mobile/src/screens/supervisor/SupervisorDashboard.tsx` (enhance)
- `/apps/mobile/src/components/supervisor/MetricCard.tsx`
- `/apps/mobile/src/components/supervisor/JobCardMobile.tsx`

---

#### Task WS-602: Mobile Job Detail & QC ⏱️ 2 days

**Objective:** Mobile job detail and QC functionality

**Features:**
- Job detail view (10 sections)
- QC checklist (mobile-optimized)
- Image verification (swipe gallery)
- Quick actions (assign, approve, reject)

**Files to Create:**
- `/apps/mobile/src/screens/supervisor/JobDetailScreen.tsx`
- `/apps/mobile/src/components/supervisor/QCChecklistMobile.tsx`
- `/apps/mobile/src/components/supervisor/ImageGallery.tsx`

---

## Database Schema Changes

### Summary of New Tables

1. **qc_checks** - Quality control records
2. **mechanic_assignments** - Mechanic assignment history
3. **supervisor_actions** - All supervisor actions logged

### Summary of Enhanced Tables

1. **service_leads** - Add QC status columns
2. **lead_extra_charges** - Add supervisor approval columns

### Total New Columns: 10+

### Total New Indexes: 7

---

## API Endpoints Implementation

### Total Endpoints: 12

1. `GET /api/supervisor/dashboard` - Dashboard metrics
2. `GET /api/supervisor/jobs` - Job list
3. `GET /api/supervisor/jobs/{id}` - Job details
4. `POST /api/leads/{id}/assign-mechanic` - Assign mechanic
5. `POST /api/leads/{id}/reassign-mechanic` - Reassign mechanic
6. `POST /api/leads/{id}/extra-work/approve` - Approve extra work
7. `POST /api/leads/{id}/extra-work/reject` - Reject extra work
8. `POST /api/leads/{id}/qc-status` - Update QC status
9. `POST /api/leads/{id}/ready-for-delivery` - Mark ready
10. `POST /api/leads/{id}/supervisor/notes` - Add notes
11. `GET /api/supervisor/analytics` - KPI data
12. `GET /api/supervisor/mechanics` - Mechanic list & performance

---

## UI/UX Components

### Total Components: 25+

**Dashboard Components:**
- DashboardMetrics
- MechanicPerformancePanel
- QuickFilters

**Job Management Components:**
- JobCard
- JobFilters
- JobSummary
- MechanicProgressPanel

**QC Components:**
- QCChecklist
- ImageVerification
- SupervisorQCSection

**Approval Components:**
- ExtraWorkApprovalCard
- ExtraWorkModal
- MechanicAssignmentModal
- ReassignMechanicModal

**Analytics Components:**
- KPICards
- PerformanceCharts
- MechanicList
- MechanicDetailView

**Mobile Components:**
- MetricCard
- JobCardMobile
- QCChecklistMobile
- ImageGallery

---

## Testing Strategy

### Unit Tests

- Test API endpoints (Jest)
- Test utility functions
- Test data transformations

### Integration Tests

- Test complete workflows:
  - Assign mechanic → Approve extra work → QC → Mark ready
  - Reassign mechanic → QC fail → Reassign again → QC pass

### E2E Tests

- Test supervisor dashboard loading
- Test job list filtering
- Test QC approval flow
- Test extra work approval

### Manual Testing Checklist

- [ ] Dashboard loads with correct metrics
- [ ] Quick filters work correctly
- [ ] Job list shows all required details
- [ ] Mechanic assignment works
- [ ] Extra work approval works
- [ ] QC checklist works
- [ ] Mark ready for delivery works
- [ ] Real-time updates work
- [ ] Mobile app works
- [ ] Analytics display correctly

---

## Timeline & Resource Allocation

### Phase 1: Week 1-2 (Core Features)

**Days:** 10 working days

**Effort:**
- Backend: 4 days
- Frontend Web: 4 days
- Testing: 2 days

### Phase 2: Week 3-4 (QC & Approvals)

**Days:** 10 working days

**Effort:**
- Backend: 3 days
- Frontend Web: 5 days
- Testing: 2 days

### Phase 3: Week 5-6 (Analytics & Mobile)

**Days:** 10 working days

**Effort:**
- Backend: 2 days
- Frontend Web: 3 days
- Mobile: 4 days
- Testing: 1 day

### Total Timeline: 6 weeks (30 working days)

---

## Risk Management

### Technical Risks

1. **Real-time Updates Performance:**
   - **Mitigation:** Use Supabase Realtime with proper filters
   - Implement pagination

2. **Image Loading on Mobile:**
   - **Mitigation:** Implement lazy loading
   - Compress images

3. **Complex QC Workflow:**
   - **Mitigation:** Break into smaller steps
   - Clear state management

### Dependency Risks

1. **Workshop Admin Features:**
   - **Status:** ✅ Complete
   - No blocking issues

2. **Database Schema:**
   - **Status:** ✅ Ready to extend
   - No conflicts expected

---

## Success Metrics

### Development Metrics

- ✅ All 12 API endpoints functional
- ✅ All 25+ components implemented
- ✅ 100% mobile parity
- ✅ < 2s dashboard load time
- ✅ Real-time updates < 500ms latency

### Business Metrics

- ✅ Supervisor can manage 10+ mechanics
- ✅ QC time < 5 minutes per job
- ✅ Extra work approval < 15 minutes
- ✅ 95%+ SLA compliance with supervisor oversight

---

## Next Steps

1. ✅ Review and approve development plan
2. ✅ Set up development environment
3. ✅ Start Phase 1, Week 1 (Database & Backend)
4. ✅ Daily standups for progress tracking
5. ✅ Weekly demos after each phase

---

**Document Version:** 1.0  
**Last Updated:** November 17, 2025  
**Status:** READY FOR DEVELOPMENT  
**Estimated Completion:** December 29, 2025 (6 weeks)

