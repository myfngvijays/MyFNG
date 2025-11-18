# 📋 WORKSHOP SUPERVISOR - TASK BREAKDOWN

**Quick Reference for Project Management**

---

## 🎯 Task Summary

| Phase | Tasks | Days | Status |
|-------|-------|------|--------|
| Phase 1 | 5 tasks | 10 days | ⏳ Pending |
| Phase 2 | 4 tasks | 10 days | ⏳ Pending |
| Phase 3 | 4 tasks | 10 days | ⏳ Pending |
| **Total** | **13 tasks** | **30 days** | **0% Complete** |

---

## 📅 PHASE 1: Core Supervisor Features (Week 1-2)

### Week 1: Database & Backend Foundation

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-101 | Database Schema Enhancements | Backend | 1 | 🔴 High | ⏳ Pending |
| WS-102 | Supervisor Dashboard Metrics API | Backend | 1 | 🔴 High | ⏳ Pending |
| WS-103 | Job List API for Supervisor | Backend | 1 | 🔴 High | ⏳ Pending |

**Week 1 Total:** 3 days

### Week 2: Frontend Dashboard & Job List

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-201 | Enhanced Supervisor Dashboard (Web) | Frontend | 2 | 🔴 High | ⏳ Pending |
| WS-202 | Supervisor Job List View | Frontend | 2 | 🔴 High | ⏳ Pending |

**Week 2 Total:** 4 days  
**Phase 1 Total:** 7 days (+ 3 days buffer/testing = 10 days)

---

## 📅 PHASE 2: QC & Approvals (Week 3-4)

### Week 3: Mechanic Assignment & Extra Work Approval

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-301 | Mechanic Assignment System | Full Stack | 2 | 🔴 High | ⏳ Pending |
| WS-302 | Extra Work Approval System | Full Stack | 2 | 🔴 High | ⏳ Pending |

**Week 3 Total:** 4 days

### Week 4: QC System & Job Detail Page

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-401 | QC Checklist Implementation | Full Stack | 2 | 🔴 High | ⏳ Pending |
| WS-402 | Supervisor Job Detail Page | Frontend | 2 | 🔴 High | ⏳ Pending |

**Week 4 Total:** 4 days  
**Phase 2 Total:** 8 days (+ 2 days buffer/testing = 10 days)

---

## 📅 PHASE 3: Analytics & Mobile (Week 5-6)

### Week 5: KPI Dashboard & Performance Tracking

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-501 | Supervisor KPI Dashboard | Full Stack | 2 | 🟡 Medium | ⏳ Pending |
| WS-502 | Mechanic Performance Tracking | Full Stack | 2 | 🟡 Medium | ⏳ Pending |

**Week 5 Total:** 4 days

### Week 6: Mobile App Integration

| Task ID | Task Name | Type | Days | Priority | Status |
|---------|-----------|------|------|----------|--------|
| WS-601 | Mobile Supervisor Dashboard | Mobile | 2 | 🟡 Medium | ⏳ Pending |
| WS-602 | Mobile Job Detail & QC | Mobile | 2 | 🟡 Medium | ⏳ Pending |

**Week 6 Total:** 4 days  
**Phase 3 Total:** 8 days (+ 2 days buffer/testing = 10 days)

---

## 📊 Task Dependencies

```
WS-101 (Database)
  ↓
WS-102 (Dashboard API) ──→ WS-201 (Dashboard UI)
  ↓
WS-103 (Job List API) ────→ WS-202 (Job List UI)
  ↓
WS-301 (Mechanic Assignment)
  ↓
WS-302 (Extra Work Approval)
  ↓
WS-401 (QC Implementation)
  ↓
WS-402 (Job Detail Page)
  ↓
WS-501 (KPI Dashboard) ────→ WS-601 (Mobile Dashboard)
  ↓
WS-502 (Performance) ──────→ WS-602 (Mobile Detail)
```

---

## 📝 Detailed Task List

### WS-101: Database Schema Enhancements

**Type:** Backend (SQL)  
**Effort:** 1 day  
**Priority:** 🔴 High

**Deliverables:**
- [ ] Create `qc_checks` table
- [ ] Create `mechanic_assignments` table
- [ ] Create `supervisor_actions` table
- [ ] Enhance `service_leads` table (5 columns)
- [ ] Enhance `lead_extra_charges` table (4 columns)
- [ ] Create 7 indexes
- [ ] Write migration script

**Files:**
- `/database/07_workshop_supervisor_enhancements.sql`

---

### WS-102: Supervisor Dashboard Metrics API

**Type:** Backend (API)  
**Effort:** 1 day  
**Priority:** 🔴 High

**Deliverables:**
- [ ] `GET /api/supervisor/dashboard` endpoint
- [ ] Fetch 8 metric counts
- [ ] Fetch mechanic performance data
- [ ] Add authentication/authorization
- [ ] Add error handling

**Files:**
- `/apps/web/src/app/api/supervisor/dashboard/route.ts`

---

### WS-103: Job List API for Supervisor

**Type:** Backend (API)  
**Effort:** 1 day  
**Priority:** 🔴 High

**Deliverables:**
- [ ] `GET /api/supervisor/jobs` endpoint
- [ ] Support filters (status, mechanic, service type)
- [ ] Support pagination
- [ ] Include image status
- [ ] Include SLA info
- [ ] Add authentication/authorization

**Files:**
- `/apps/web/src/app/api/supervisor/jobs/route.ts`

---

### WS-201: Enhanced Supervisor Dashboard (Web)

**Type:** Frontend (React/Next.js)  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] 8 metric cards with live data
- [ ] Mechanic performance panel
- [ ] Quick filter buttons
- [ ] Real-time updates (Supabase)
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling

**Files:**
- `/apps/web/src/app/dashboard/workshop_supervisor/page.tsx`
- `/apps/web/src/components/supervisor/DashboardMetrics.tsx`
- `/apps/web/src/components/supervisor/MechanicPerformancePanel.tsx`
- `/apps/web/src/components/supervisor/QuickFilters.tsx`

---

### WS-202: Supervisor Job List View

**Type:** Frontend (React/Next.js)  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] Job card component with 12+ fields
- [ ] Quick action buttons
- [ ] Filters (status, mechanic, service)
- [ ] Search functionality
- [ ] Pagination
- [ ] SLA color coding
- [ ] Image status indicators
- [ ] Real-time updates

**Files:**
- `/apps/web/src/app/dashboard/workshop_supervisor/jobs/page.tsx`
- `/apps/web/src/components/supervisor/JobCard.tsx`
- `/apps/web/src/components/supervisor/JobFilters.tsx`

---

### WS-301: Mechanic Assignment System

**Type:** Full Stack  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] `POST /api/leads/{id}/assign-mechanic` endpoint
- [ ] `POST /api/leads/{id}/reassign-mechanic` endpoint
- [ ] Assignment modal UI
- [ ] Reassignment modal UI
- [ ] Show mechanic workload
- [ ] Log assignment events
- [ ] Notifications

**Files:**
- `/apps/web/src/app/api/leads/[id]/assign-mechanic/route.ts`
- `/apps/web/src/app/api/leads/[id]/reassign-mechanic/route.ts`
- `/apps/web/src/components/supervisor/MechanicAssignmentModal.tsx`
- `/apps/web/src/components/supervisor/ReassignMechanicModal.tsx`

---

### WS-302: Extra Work Approval System

**Type:** Full Stack  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] `POST /api/leads/{id}/extra-work/approve` endpoint
- [ ] `POST /api/leads/{id}/extra-work/reject` endpoint
- [ ] Extra work approval card UI
- [ ] Approval modal with image preview
- [ ] Rejection reason input
- [ ] Log approval events
- [ ] Notifications to mechanic

**Files:**
- `/apps/web/src/app/api/leads/[id]/extra-work/approve/route.ts`
- `/apps/web/src/app/api/leads/[id]/extra-work/reject/route.ts`
- `/apps/web/src/components/supervisor/ExtraWorkApprovalCard.tsx`
- `/apps/web/src/components/supervisor/ExtraWorkModal.tsx`

---

### WS-401: QC Checklist Implementation

**Type:** Full Stack  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] `POST /api/leads/{id}/qc-status` endpoint
- [ ] 10-point QC checklist UI
- [ ] Image verification UI with zoom
- [ ] QC PASSED action
- [ ] QC FAILED action (with notes)
- [ ] Update lead status
- [ ] Log QC events

**Files:**
- `/apps/web/src/app/api/leads/[id]/qc-status/route.ts`
- `/apps/web/src/components/supervisor/QCChecklist.tsx`
- `/apps/web/src/components/supervisor/ImageVerification.tsx`

---

### WS-402: Supervisor Job Detail Page

**Type:** Frontend (React/Next.js)  
**Effort:** 2 days  
**Priority:** 🔴 High

**Deliverables:**
- [ ] 10 sections job detail page
- [ ] Job summary section
- [ ] Mechanic progress panel
- [ ] Extra work section
- [ ] QC section
- [ ] Communication section
- [ ] Action buttons
- [ ] Activity timeline
- [ ] Real-time updates

**Files:**
- `/apps/web/src/app/dashboard/workshop_supervisor/jobs/[id]/page.tsx`
- `/apps/web/src/components/supervisor/JobSummary.tsx`
- `/apps/web/src/components/supervisor/MechanicProgressPanel.tsx`
- `/apps/web/src/components/supervisor/SupervisorQCSection.tsx`
- `/apps/web/src/components/supervisor/SupervisorCommunication.tsx`

---

### WS-501: Supervisor KPI Dashboard

**Type:** Full Stack  
**Effort:** 2 days  
**Priority:** 🟡 Medium

**Deliverables:**
- [ ] `GET /api/supervisor/analytics` endpoint
- [ ] KPI cards (6 metrics)
- [ ] 4 charts (pie, bar, 2 line)
- [ ] Date range filters
- [ ] Export to CSV
- [ ] Real-time updates

**Files:**
- `/apps/web/src/app/dashboard/workshop_supervisor/analytics/page.tsx`
- `/apps/web/src/components/supervisor/KPICards.tsx`
- `/apps/web/src/components/supervisor/PerformanceCharts.tsx`

---

### WS-502: Mechanic Performance Tracking

**Type:** Full Stack  
**Effort:** 2 days  
**Priority:** 🟡 Medium

**Deliverables:**
- [ ] `GET /api/supervisor/mechanics` endpoint
- [ ] Mechanic list view
- [ ] Individual mechanic detail view
- [ ] Performance comparison view
- [ ] Efficiency metrics
- [ ] Job history

**Files:**
- `/apps/web/src/app/dashboard/workshop_supervisor/mechanics/page.tsx`
- `/apps/web/src/components/supervisor/MechanicList.tsx`
- `/apps/web/src/components/supervisor/MechanicDetailView.tsx`

---

### WS-601: Mobile Supervisor Dashboard

**Type:** Mobile (React Native)  
**Effort:** 2 days  
**Priority:** 🟡 Medium

**Deliverables:**
- [ ] Dashboard with 8 metric cards
- [ ] Mechanic performance panel
- [ ] Quick filters
- [ ] Job list view
- [ ] Real-time updates
- [ ] Pull to refresh

**Files:**
- `/apps/mobile/src/screens/supervisor/SupervisorDashboard.tsx`
- `/apps/mobile/src/components/supervisor/MetricCard.tsx`
- `/apps/mobile/src/components/supervisor/JobCardMobile.tsx`

---

### WS-602: Mobile Job Detail & QC

**Type:** Mobile (React Native)  
**Effort:** 2 days  
**Priority:** 🟡 Medium

**Deliverables:**
- [ ] Job detail screen (10 sections)
- [ ] QC checklist (mobile-optimized)
- [ ] Image gallery with swipe
- [ ] Quick actions
- [ ] Real-time updates

**Files:**
- `/apps/mobile/src/screens/supervisor/JobDetailScreen.tsx`
- `/apps/mobile/src/components/supervisor/QCChecklistMobile.tsx`
- `/apps/mobile/src/components/supervisor/ImageGallery.tsx`

---

## 🎯 Sprint Planning (2-week sprints)

### Sprint 1 (Week 1-2): Foundation + Dashboard

**Goals:**
- ✅ Database ready
- ✅ APIs functional
- ✅ Dashboard live
- ✅ Job list working

**Tasks:** WS-101, WS-102, WS-103, WS-201, WS-202

---

### Sprint 2 (Week 3-4): QC & Approvals

**Goals:**
- ✅ Mechanic assignment working
- ✅ Extra work approval functional
- ✅ QC system complete
- ✅ Job detail page live

**Tasks:** WS-301, WS-302, WS-401, WS-402

---

### Sprint 3 (Week 5-6): Analytics & Mobile

**Goals:**
- ✅ KPI dashboard complete
- ✅ Performance tracking working
- ✅ Mobile app parity
- ✅ All features tested

**Tasks:** WS-501, WS-502, WS-601, WS-602

---

## 📊 Progress Tracking

### Overall Progress

```
Phase 1: ░░░░░░░░░░ 0% (0/5 tasks)
Phase 2: ░░░░░░░░░░ 0% (0/4 tasks)
Phase 3: ░░░░░░░░░░ 0% (0/4 tasks)

Total:   ░░░░░░░░░░ 0% (0/13 tasks)
```

### Tasks by Status

- ⏳ Pending: 13
- 🔄 In Progress: 0
- ✅ Complete: 0
- ❌ Blocked: 0

---

## 🚀 Quick Start Checklist

Before starting development:

- [ ] Review master document
- [ ] Review development plan
- [ ] Set up development environment
- [ ] Create feature branch
- [ ] Run existing tests
- [ ] Verify Workshop Admin features work

---

**Last Updated:** November 17, 2025  
**Status:** READY TO START  
**Next Action:** Begin WS-101 (Database Schema Enhancements)

