# 🏛 SUB_ADMIN ROLE - COMPLETE IMPLEMENTATION PLAN

## 📋 EXECUTIVE SUMMARY

This document outlines the complete step-by-step implementation plan for SUB_ADMIN role with 3 department types:
1. **Customer Service Sub-Admin (CS Manager)**
2. **Telecaller Sub-Admin (Telecalling Manager)**
3. **Auditor Sub-Admin (Audit Manager)**

---

## 🎯 PHASE 1: DATABASE SCHEMA & FOUNDATION

### 1.1 Database Migrations

#### Migration 1: Add Department Constraint to Users
**File:** `database/68_add_subadmin_department_constraint.sql`

**Note:** `department` field already exists in `users_login` table. We just need to add constraint.

```sql
-- Add department constraint for SUB_ADMIN (if not exists)
DO $$
BEGIN
  -- Drop constraint if exists to avoid errors
  ALTER TABLE users_login DROP CONSTRAINT IF EXISTS check_subadmin_department;
  
  -- Add constraint: SUB_ADMIN must have department, others can have NULL
  ALTER TABLE users_login 
  ADD CONSTRAINT check_subadmin_department 
  CHECK (
    (role_id IN (SELECT id FROM roles WHERE role_code = 'SUB_ADMIN') AND department IN ('CSE', 'TELECALLER', 'AUDITOR'))
    OR 
    (role_id NOT IN (SELECT id FROM roles WHERE role_code = 'SUB_ADMIN'))
  );
  
  RAISE NOTICE '✅ Department constraint added for SUB_ADMIN';
END $$;

-- Create index for department queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_department ON users_login(department) WHERE department IS NOT NULL;
```

#### Migration 2: Create Sub Admin Team Management Table
**File:** `database/69_create_subadmin_team_management.sql`

```sql
-- Team assignment table (Sub Admin -> Team Members)
CREATE TABLE IF NOT EXISTS subadmin_team_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subadmin_id UUID NOT NULL REFERENCES users_login(id),
  team_member_id UUID NOT NULL REFERENCES users_login(id),
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES users_login(id),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subadmin_id, team_member_id, department)
);

CREATE INDEX idx_subadmin_team_subadmin ON subadmin_team_assignments(subadmin_id);
CREATE INDEX idx_subadmin_team_member ON subadmin_team_assignments(team_member_id);
CREATE INDEX idx_subadmin_team_dept ON subadmin_team_assignments(department);
```

#### Migration 3: Create Sub Admin Actions Log Table
**File:** `database/70_create_subadmin_actions.sql`

```sql
-- Sub Admin actions log
CREATE TABLE IF NOT EXISTS subadmin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subadmin_id UUID NOT NULL REFERENCES users_login(id),
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  action_type VARCHAR(100) NOT NULL, -- ASSIGN, REASSIGN, ESCALATE, APPROVE_REFUND, APPROVE_AUDIT, etc.
  action_description TEXT,
  related_entity_type VARCHAR(50), -- LEAD, TICKET, AUDIT, REFUND
  related_entity_id UUID,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subadmin_actions_subadmin ON subadmin_actions(subadmin_id);
CREATE INDEX idx_subadmin_actions_dept ON subadmin_actions(department);
CREATE INDEX idx_subadmin_actions_entity ON subadmin_actions(related_entity_type, related_entity_id);
CREATE INDEX idx_subadmin_actions_type ON subadmin_actions(action_type);
```

#### Migration 4: Create SLA Monitoring Table
**File:** `database/71_create_sla_monitoring.sql`

```sql
-- SLA monitoring for Sub Admins
CREATE TABLE IF NOT EXISTS subadmin_sla_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(50) NOT NULL CHECK (department IN ('CSE', 'TELECALLER', 'AUDITOR')),
  entity_type VARCHAR(50) NOT NULL, -- TICKET, LEAD, AUDIT, FOLLOWUP
  entity_id UUID NOT NULL,
  sla_type VARCHAR(50) NOT NULL, -- FIRST_RESPONSE, RESOLUTION, FOLLOWUP, AUDIT_COMPLETION
  sla_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  sla_status VARCHAR(50) DEFAULT 'ON_TIME' CHECK (sla_status IN ('ON_TIME', 'AT_RISK', 'BREACHED')),
  breached_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  subadmin_notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sla_dept ON subadmin_sla_monitoring(department);
CREATE INDEX idx_sla_status ON subadmin_sla_monitoring(sla_status);
CREATE INDEX idx_sla_deadline ON subadmin_sla_monitoring(sla_deadline);
CREATE INDEX idx_sla_entity ON subadmin_sla_monitoring(entity_type, entity_id);
```

#### Migration 5: Create Escalation Management Table
**File:** `database/72_create_escalation_management.sql`

**Note:** This table centralizes escalation management. Existing tables (`customer_complaints`, `support_tickets`) have escalation fields but this provides unified tracking.

```sql
-- See database/72_create_escalation_management.sql for full SQL
-- Includes auto-generation of escalation_number (ESC-YYYYMMDD-XXXXX)
-- Supports escalation to Super Admin
-- Links to leads, tickets, audits, customers, workshops
```

---

### 1.2 Existing Tables Usage

**Important:** The following tables already exist and will be used:

#### CSE Sub Admin:
- ✅ `customer_complaints` - Main ticket/complaint table
- ✅ `support_tickets` - Alternative ticket system
- ✅ `cse_followups` - Follow-up tracking
- ✅ `cse_performance_metrics` - Performance metrics
- ✅ `refund_requests` - Refund approvals

#### Telecaller Sub Admin:
- ✅ `service_leads` - Leads with telecaller fields (`is_incomplete`, `assigned_telecaller_id`, etc.)
- ✅ `telecaller_follow_ups` - Follow-up tracking
- ✅ `telecaller_call_logs` - Call logs
- ✅ `telecaller_performance_metrics` - Performance metrics

#### Auditor Sub Admin:
- ✅ `workshop_audits` - Audit management (has `approved_by`, `approved_at`, `rejection_reason`)
- ✅ `audit_checklist_items` - Checklist items
- ✅ `audit_action_items` - Action items
- ✅ `auditor_performance_metrics` - Performance metrics
- ✅ `audit_media` - Audit photos/media

#### Common:
- ✅ `notifications` - For Sub Admin notifications
- ✅ `users_login` - Has `department` field (needs constraint only)

---

## 🎯 PHASE 2: API ENDPOINTS IMPLEMENTATION

### 2.1 Common Sub Admin APIs

#### API 1: Dashboard Data
**File:** `apps/web/src/app/api/subadmin/dashboard/route.ts`

**GET /api/subadmin/dashboard**

**Features:**
- Team performance overview (online/offline staff)
- Tasks assigned today
- SLA breaches count
- Pending escalations
- Quality score
- Department-specific metrics

**Response Structure:**
```typescript
{
  team_overview: {
    total_staff: number,
    online_staff: number,
    offline_staff: number,
    tasks_assigned_today: number,
    sla_breaches: number,
    pending_escalations: number,
    quality_score: number
  },
  department_metrics: {
    // CSE specific
    open_tickets?: number,
    sla_pending?: number,
    resolutions_today?: number,
    customer_satisfaction_score?: number,
    
    // Telecaller specific
    followups_today?: number,
    leads_created?: number,
    conversion_rate?: number,
    pending_callbacks?: number,
    
    // Auditor specific
    audits_scheduled?: number,
    audits_completed?: number,
    failed_audits?: number,
    pending_approvals?: number,
    workshops_under_observation?: number
  },
  alerts: Array<{
    type: string,
    severity: string,
    message: string,
    entity_id: string,
    entity_type: string
  }>
}
```

#### API 2: Team Management
**File:** `apps/web/src/app/api/subadmin/team/route.ts`

**GET /api/subadmin/team** - Get team members
**POST /api/subadmin/team/assign** - Assign team member
**POST /api/subadmin/team/reassign** - Reassign team member
**GET /api/subadmin/team/performance** - Team performance metrics

#### API 3: Leads Management (Department-specific)
**File:** `apps/web/src/app/api/subadmin/leads/route.ts`

**GET /api/subadmin/leads?dept=CSE|TELECALLER|AUDITOR**

**Features:**
- Filter by department
- Filter by status
- Filter by SLA status
- Search by phone, lead ID, customer name

#### API 4: Assignment & Reassignment
**File:** `apps/web/src/app/api/subadmin/assign/route.ts`

**POST /api/subadmin/assign**
- Assign ticket to CSE
- Assign lead to Telecaller
- Assign audit to Auditor

**POST /api/subadmin/reassign**
- Reassign ticket/lead/audit

#### API 5: Status Updates
**File:** `apps/web/src/app/api/subadmin/update-status/route.ts`

**POST /api/subadmin/update-status**
- Update ticket status
- Update lead status
- Update audit status

#### API 6: Escalation Handling
**File:** `apps/web/src/app/api/subadmin/escalate/route.ts`

**POST /api/subadmin/escalate**
- Create escalation
- Acknowledge escalation
- Resolve escalation
- Escalate to Super Admin

---

### 2.2 Customer Service Sub-Admin Specific APIs

#### API 7: Ticket Management
**File:** `apps/web/src/app/api/subadmin/cse/tickets/route.ts`

**GET /api/subadmin/cse/tickets**
- View all tickets (OPEN/IN_PROGRESS/ESCALATED)
- Filter by SLA status
- Filter by category
- Filter by assigned CSE

**POST /api/subadmin/cse/tickets/[id]/assign**
- Assign ticket to CSE

**POST /api/subadmin/cse/tickets/[id]/reassign**
- Reassign ticket

**POST /api/subadmin/cse/tickets/[id]/merge**
- Merge duplicate tickets

**POST /api/subadmin/cse/tickets/[id]/close**
- Close ticket with resolution

#### API 8: Refund Approvals
**File:** `apps/web/src/app/api/subadmin/cse/approve-refund/route.ts`

**POST /api/subadmin/cse/approve-refund**
- Approve refund request
- Set refund amount
- Add approval notes

**POST /api/subadmin/cse/reject-refund**
- Reject refund request
- Add rejection reason

#### API 9: Compensation Approvals
**File:** `apps/web/src/app/api/subadmin/cse/approve-compensation/route.ts`

**POST /api/subadmin/cse/approve-compensation**
- Approve compensation coupon
- Approve reschedule exception
- Approve preferential slot

---

### 2.3 Telecaller Sub-Admin Specific APIs

#### API 10: Lead Quality Management
**File:** `apps/web/src/app/api/subadmin/telecaller/leads/route.ts`

**GET /api/subadmin/telecaller/leads**
- View incomplete leads
- View duplicate leads
- View follow-ups due today

**POST /api/subadmin/telecaller/leads/[id]/correct**
- Correct lead fields (customer details, model, variant, address)

**POST /api/subadmin/telecaller/leads/[id]/assign**
- Assign lead to Telecaller

**POST /api/subadmin/telecaller/leads/[id]/reassign**
- Reassign lead

**POST /api/subadmin/telecaller/leads/[id]/escalate**
- Escalate to Lead Manager

#### API 11: Follow-up Monitoring
**File:** `apps/web/src/app/api/subadmin/telecaller/followups/route.ts`

**GET /api/subadmin/telecaller/followups**
- View missed follow-ups
- View wrong status updates
- View no-call situations
- View fake lead updates

**POST /api/subadmin/telecaller/followups/[id]/mark-complete**
- Mark follow-up as complete

#### API 12: Telecaller Performance
**File:** `apps/web/src/app/api/subadmin/telecaller/performance/route.ts`

**GET /api/subadmin/telecaller/performance**
- Calls per day
- Lead conversion rate
- Lead accuracy
- Follow-up compliance
- Duplicate/fake entries

**POST /api/subadmin/telecaller/feedback**
- Issue warning
- Provide feedback

---

### 2.4 Auditor Sub-Admin Specific APIs

#### API 13: Audit Scheduling
**File:** `apps/web/src/app/api/subadmin/auditor/schedule/route.ts`

**GET /api/subadmin/auditor/schedule**
- View workshop visits required
- View pending audits
- View missed audits
- View re-audit requests

**POST /api/subadmin/auditor/schedule/assign**
- Assign auditor to audit

#### API 14: Audit Review & Approval
**File:** `apps/web/src/app/api/subadmin/auditor/approve/route.ts`

**POST /api/subadmin/auditor/approve**
- Approve audit submission
- Add approval notes

**POST /api/subadmin/auditor/reject**
- Reject audit with feedback
- Request re-audit

**POST /api/subadmin/auditor/escalate**
- Escalate to Super Admin
- Block workshop temporarily

#### API 15: Audit Reports
**File:** `apps/web/src/app/api/subadmin/auditor/reports/route.ts`

**GET /api/subadmin/auditor/reports/daily**
- Daily audit report

**GET /api/subadmin/auditor/reports/workshop-ratings**
- Workshop ratings

**GET /api/subadmin/auditor/reports/auditor-performance**
- Auditor performance metrics

---

## 🎯 PHASE 3: FRONTEND DASHBOARD IMPLEMENTATION

### 3.1 Common Dashboard Components

#### Component 1: Sub Admin Dashboard Layout
**File:** `apps/web/src/app/dashboard/subadmin/page.tsx`

**Features:**
- Department-specific header
- Team performance cards
- SLA monitoring widget
- Escalation corner
- Quick action buttons
- Real-time notifications

#### Component 2: Team Performance Overview
**File:** `apps/web/src/components/subadmin/TeamPerformanceOverview.tsx`

**Features:**
- Online/offline staff count
- Tasks assigned today
- SLA breaches
- Quality score display
- Team leaderboard

#### Component 3: SLA Monitoring Widget
**File:** `apps/web/src/components/subadmin/SLAMonitoringWidget.tsx`

**Features:**
- Color-coded SLA badges (ON_TIME/AT_RISK/BREACHED)
- Count of SLA breaches
- List of at-risk items
- Quick action buttons

#### Component 4: Escalation Corner
**File:** `apps/web/src/components/subadmin/EscalationCorner.tsx`

**Features:**
- Pending escalations count
- Priority-based sorting
- Quick view details
- Action buttons

---

### 3.2 Customer Service Sub-Admin Dashboard

#### Component 5: CSE Dashboard
**File:** `apps/web/src/app/dashboard/subadmin/cse/page.tsx`

**Features:**
- Open tickets count
- SLA pending count
- Resolutions today
- Customer satisfaction score
- Ticket list with filters
- Bulk actions

#### Component 6: Ticket Management
**File:** `apps/web/src/app/dashboard/subadmin/cse/tickets/page.tsx`

**Features:**
- Ticket list (OPEN/IN_PROGRESS/ESCALATED)
- Filter by SLA status
- Filter by category
- Filter by assigned CSE
- Assign/Reassign functionality
- Merge duplicate tickets
- Close ticket with resolution

#### Component 7: Refund Approval Modal
**File:** `apps/web/src/components/subadmin/cse/RefundApprovalModal.tsx`

**Features:**
- Refund request details
- Approve/Reject buttons
- Amount input
- Notes field

---

### 3.3 Telecaller Sub-Admin Dashboard

#### Component 8: Telecaller Dashboard
**File:** `apps/web/src/app/dashboard/subadmin/telecaller/page.tsx`

**Features:**
- Follow-ups today count
- Leads created count
- Conversion rate
- Pending callbacks
- Lead quality issues
- Duplicate leads

#### Component 9: Lead Quality Management
**File:** `apps/web/src/app/dashboard/subadmin/telecaller/leads/page.tsx`

**Features:**
- Incomplete leads list
- Duplicate leads detection
- Lead correction form
- Assign/Reassign functionality
- Escalate to Lead Manager

#### Component 10: Follow-up Monitoring
**File:** `apps/web/src/app/dashboard/subadmin/telecaller/followups/page.tsx`

**Features:**
- Missed follow-ups list
- Wrong status updates
- No-call situations
- Fake lead updates
- Mark complete functionality

#### Component 11: Telecaller Performance
**File:** `apps/web/src/app/dashboard/subadmin/telecaller/performance/page.tsx`

**Features:**
- Calls per day chart
- Conversion rate chart
- Lead accuracy metrics
- Follow-up compliance
- Duplicate/fake entries
- Issue warning/feedback

---

### 3.4 Auditor Sub-Admin Dashboard

#### Component 12: Auditor Dashboard
**File:** `apps/web/src/app/dashboard/subadmin/auditor/page.tsx`

**Features:**
- Audits scheduled count
- Audits completed count
- Failed audits count
- Pending approvals count
- Workshops under observation

#### Component 13: Audit Scheduling
**File:** `apps/web/src/app/dashboard/subadmin/auditor/schedule/page.tsx`

**Features:**
- Calendar view for audit scheduling
- Workshop visits required
- Pending audits
- Missed audits
- Re-audit requests
- Assign auditor functionality

#### Component 14: Audit Review & Approval
**File:** `apps/web/src/app/dashboard/subadmin/auditor/reviews/page.tsx`

**Features:**
- Audit submissions list
- Before/after images viewer
- Job card details
- Issues found display
- Approve/Reject buttons
- Request re-audit
- Escalate to Super Admin

#### Component 15: Audit Reports
**File:** `apps/web/src/app/dashboard/subadmin/auditor/reports/page.tsx`

**Features:**
- Daily audit report
- Workshop ratings chart
- Auditor performance metrics
- Export functionality

---

## 🎯 PHASE 4: MOBILE APP IMPLEMENTATION

### 4.1 Common Mobile Components

#### Screen 1: Sub Admin Dashboard (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/SubAdminDashboard.tsx`

**Features:**
- Department-specific header
- Team performance cards
- SLA monitoring
- Escalation alerts
- Quick actions

#### Screen 2: Team Management (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/TeamManagementScreen.tsx`

**Features:**
- Team member list
- Assign/Reassign functionality
- Performance metrics
- Attendance tracking

---

### 4.2 CSE Sub-Admin Mobile Screens

#### Screen 3: CSE Dashboard (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/cse/CSEDashboardScreen.tsx`

#### Screen 4: Ticket Management (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/cse/TicketManagementScreen.tsx`

#### Screen 5: Refund Approvals (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/cse/RefundApprovalScreen.tsx`

---

### 4.3 Telecaller Sub-Admin Mobile Screens

#### Screen 6: Telecaller Dashboard (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/telecaller/TelecallerDashboardScreen.tsx`

#### Screen 7: Lead Quality Management (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/telecaller/LeadQualityScreen.tsx`

#### Screen 8: Follow-up Monitoring (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/telecaller/FollowupMonitoringScreen.tsx`

---

### 4.4 Auditor Sub-Admin Mobile Screens

#### Screen 9: Auditor Dashboard (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/auditor/AuditorDashboardScreen.tsx`

#### Screen 10: Audit Scheduling (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/auditor/AuditSchedulingScreen.tsx`

#### Screen 11: Audit Review (Mobile)
**File:** `apps/mobile/src/screens/dashboard/subadmin/auditor/AuditReviewScreen.tsx`

---

## 🎯 PHASE 5: PERMISSIONS & RBAC

### 5.1 Update Role Permissions
**File:** `shared/constants/roles.ts`

**Update SUB_ADMIN permissions:**
```typescript
[UserRole.SUB_ADMIN]: [
  'view_department_leads',
  'edit_incomplete_data',
  'assign_tasks',
  'reassign_tasks',
  'override_team_decisions',
  'approve_refunds',
  'approve_compensation',
  'mark_escalations',
  'view_workshop_details',
  'access_history',
  'view_sla_dashboard',
  'manage_team_attendance',
  'manage_team_performance',
  'lock_unlock_tasks',
  'approve_audits',
  'reject_audits',
  'escalate_to_superadmin'
]
```

### 5.2 Create Permission Middleware
**File:** `apps/web/src/lib/middleware/subadminPermissions.ts`

**Features:**
- Check department access
- Verify team member assignment
- Validate action permissions
- Log all actions

---

## 🎯 PHASE 6: NOTIFICATIONS & EVENTS

### 6.1 Notification Service
**File:** `apps/web/src/lib/services/subadminNotifications.ts`

**Notification Types:**
- SLA breached
- Major customer complaints
- Telecaller low accuracy
- Auditor missed visits
- Lead escalated
- Customer escalation (angry/urgent)
- Workshop dispute
- Quality failure
- Towing required
- Emergency cases

### 6.2 Real-time Subscriptions
**File:** `apps/web/src/lib/services/subadminRealtime.ts`

**Features:**
- Real-time SLA updates
- Real-time escalation alerts
- Real-time team status updates
- Real-time ticket/lead/audit updates

---

## 🎯 PHASE 7: KPI & PERFORMANCE METRICS

### 7.1 CSE Sub-Admin KPIs
**File:** `apps/web/src/lib/services/kpis/cseKPIs.ts`

**Metrics:**
- First response time
- Ticket resolution time
- Customer satisfaction score
- Repeat complaints rate

### 7.2 Telecaller Sub-Admin KPIs
**File:** `apps/web/src/lib/services/kpis/telecallerKPIs.ts`

**Metrics:**
- Conversion rate
- Lead accuracy
- Call audits score
- Follow-up completion %

### 7.3 Auditor Sub-Admin KPIs
**File:** `apps/web/src/lib/services/kpis/auditorKPIs.ts`

**Metrics:**
- Audit completion rate
- Accuracy score
- Number of re-audits
- Workshop quality improvement trends

---

## 🎯 PHASE 8: UI/UX IMPLEMENTATION

### 8.1 Design Guidelines

**Color Coding:**
- ON_TIME: Green
- AT_RISK: Yellow/Orange
- BREACHED: Red
- URGENT: Red with pulse
- HIGH: Orange
- MEDIUM: Yellow
- LOW: Blue

**Components:**
- Department-specific tabs
- Team leaderboard
- Color-coded SLA badges
- Escalation corner (always visible)
- Issue-type based cards
- Advanced search (phone, lead ID, customer name)
- Bulk actions (assign, close, reassign)
- Calendar view for audit scheduling
- Real-time notifications badge

### 8.2 Responsive Design
- Mobile-first approach
- Touch-optimized buttons
- Swipe actions
- Pull-to-refresh
- Infinite scroll for lists

---

## 🎯 PHASE 9: TESTING & VALIDATION

### 9.1 Unit Tests
- API endpoint tests
- Permission checks
- Data validation
- Business logic tests

### 9.2 Integration Tests
- End-to-end workflows
- Department-specific flows
- Escalation handling
- Approval workflows

### 9.3 User Acceptance Testing
- CSE Sub-Admin workflow
- Telecaller Sub-Admin workflow
- Auditor Sub-Admin workflow

---

## 🎯 PHASE 10: DOCUMENTATION

### 10.1 API Documentation
- All endpoints documented
- Request/response examples
- Error handling

### 10.2 User Guide
- CSE Sub-Admin guide
- Telecaller Sub-Admin guide
- Auditor Sub-Admin guide

### 10.3 Admin Guide
- How to create Sub Admin
- How to assign department
- How to manage teams

---

## 📊 IMPLEMENTATION PRIORITY

### 🔴 HIGH PRIORITY (Week 1-2)
1. Database migrations
2. Basic API endpoints
3. Dashboard layout
4. Team management
5. SLA monitoring

### 🟡 MEDIUM PRIORITY (Week 3-4)
1. Department-specific features
2. Escalation handling
3. Approval workflows
4. Mobile app screens

### 🟢 LOW PRIORITY (Week 5-6)
1. Advanced reports
2. Performance analytics
3. Notifications optimization
4. UI/UX polish

---

## ✅ CHECKLIST

### Database
- [ ] Migration 1: Add department field
- [ ] Migration 2: Team management table
- [ ] Migration 3: Actions log table
- [ ] Migration 4: SLA monitoring table
- [ ] Migration 5: Escalation management table

### APIs
- [ ] Common dashboard API
- [ ] Team management APIs
- [ ] Leads management APIs
- [ ] Assignment/Reassignment APIs
- [ ] Escalation APIs
- [ ] CSE-specific APIs (tickets, refunds)
- [ ] Telecaller-specific APIs (leads, followups)
- [ ] Auditor-specific APIs (schedule, approve)

### Frontend (Web)
- [ ] Sub Admin dashboard layout
- [ ] Team performance components
- [ ] SLA monitoring widget
- [ ] Escalation corner
- [ ] CSE dashboard & tickets
- [ ] Telecaller dashboard & leads
- [ ] Auditor dashboard & audits

### Frontend (Mobile)
- [ ] Sub Admin dashboard (mobile)
- [ ] Team management (mobile)
- [ ] CSE screens (mobile)
- [ ] Telecaller screens (mobile)
- [ ] Auditor screens (mobile)

### Permissions & Security
- [ ] RBAC implementation
- [ ] Department-based access control
- [ ] Action logging
- [ ] Permission middleware

### Notifications
- [ ] Notification service
- [ ] Real-time subscriptions
- [ ] Email/SMS notifications
- [ ] Push notifications (mobile)

### KPIs & Metrics
- [ ] CSE KPIs
- [ ] Telecaller KPIs
- [ ] Auditor KPIs
- [ ] Dashboard widgets

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] UAT

### Documentation
- [ ] API documentation
- [ ] User guides
- [ ] Admin guide

---

## 🎯 FINAL NOTES

- **No point should be missed** - Every feature from the document must be implemented
- **Department-specific** - Each Sub Admin type has unique features
- **Real-time updates** - All dashboards must show live data
- **Mobile support** - Full functionality on mobile app
- **SLA monitoring** - Critical feature for all departments
- **Escalation handling** - Must be prominent and easy to use
- **Team management** - Core functionality for Sub Admins
- **Approvals** - CSE can approve refunds, Auditor can approve audits
- **Performance tracking** - KPIs for each department
- **Notifications** - Real-time alerts for critical events

---

**Total Estimated Time:** 6 weeks
**Team Size:** 2-3 developers
**Priority:** HIGH

