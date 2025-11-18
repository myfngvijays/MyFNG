# 🚀 WORKSHOP ADMIN - COMPREHENSIVE DEVELOPMENT PLAN

**Based on:** WORKSHOP_ADMIN_COMPLETE_FUNCTIONALITY.md  
**Created:** 2024  
**Status:** Master Development Plan

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Phase 1: MVP - Core Functionality](#phase-1-mvp---core-functionality)
4. [Phase 2: Enhanced Features](#phase-2-enhanced-features)
5. [Phase 3: Advanced Features](#phase-3-advanced-features)
6. [Database Schema Changes](#database-schema-changes)
7. [API Endpoints Implementation](#api-endpoints-implementation)
8. [UI/UX Components](#uiux-components)
9. [Testing Strategy](#testing-strategy)
10. [Timeline & Resource Allocation](#timeline--resource-allocation)
11. [Risk Management](#risk-management)

---

## Executive Summary

### Project Overview
Complete implementation of Workshop Admin functionality for MyFNG platform, enabling workshop administrators to manage leads, assign staff, track SLA, and oversee workshop operations.

### Key Objectives
- ✅ Lead management workflow (Accept/Reject/Assign)
- ✅ Real-time lead dashboard with SLA tracking
- ✅ Complete 12-section lead detail page
- ✅ Staff assignment system (Mechanics/Pickup Boys)
- ✅ Media upload and management
- ✅ Extra charges and invoice generation
- ✅ Reporting and analytics dashboard

### Estimated Timeline
- **Phase 1 (MVP):** 3-4 weeks
- **Phase 2 (Enhanced):** 4-5 weeks
- **Phase 3 (Advanced):** 3-4 weeks
- **Total:** 10-13 weeks

---

## Current State Analysis

### ✅ Already Implemented

1. **Basic Workshop Admin Dashboard**
   - Location: `apps/web/src/app/dashboard/workshop_admin/page.tsx`
   - Features: Pending leads display, basic stats, active jobs overview
   - Status: Functional but needs enhancement

2. **Leads Management Page**
   - Location: `apps/web/src/app/dashboard/workshop_admin/leads/page.tsx`
   - Features: Filter by status, Accept/Reject functionality
   - Status: Basic implementation, needs full detail page

3. **Staff Management**
   - Location: `apps/web/src/app/dashboard/workshop_admin/staff/page.tsx`
   - Features: Create/edit staff, role assignment
   - Status: Complete ✅

4. **Database Schema**
   - `service_leads` table exists
   - Basic status workflow implemented
   - Missing: SLA tracking, pricing tables, media tables

### ❌ Missing/Incomplete

1. **Lead Detail Page** - Not implemented (12 sections)
2. **SLA Timer System** - Not implemented
3. **Real-time Notifications** - Not implemented
4. **Media Upload** - Not implemented
5. **Extra Charges Management** - Not implemented
6. **Job Card System** - Not implemented
7. **Invoice Generation** - Not implemented
8. **Audit System** - Not implemented
9. **Communication Logs** - Not implemented
10. **Service History** - Not implemented
11. **Reporting Dashboard** - Not implemented
12. **Mobile App Lead Management** - Basic only

---

## Phase 1: MVP - Core Functionality

**Duration:** 3-4 weeks  
**Priority:** CRITICAL  
**Goal:** Enable Workshop Admin to accept/reject leads and track basic workflow

### Week 1: Database & Backend Foundation

#### Task 1.1: Database Schema Enhancements
**Estimated:** 2 days

**Database Changes:**
```sql
-- Add SLA tracking columns to service_leads
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS sla_accept_deadline TIMESTAMP;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS sla_assign_deadline TIMESTAMP;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS sla_start_deadline TIMESTAMP;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'ON_TIME';
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_mechanic_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_pickup_boy_id UUID;
ALTER TABLE service_leads ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID;

-- Create lead_events table for tracking
CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  created_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_leads_workshop_status ON service_leads(workshop_id, status);
CREATE INDEX IF NOT EXISTS idx_service_leads_sla_status ON service_leads(sla_status);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
```

**Acceptance Criteria:**
- [ ] All columns added successfully
- [ ] Indexes created for performance
- [ ] Foreign key constraints working
- [ ] Migration script tested

#### Task 1.2: SLA Timer Service
**Estimated:** 3 days

**Files to Create:**
- `apps/web/src/lib/services/slaService.ts`
- `apps/mobile/src/services/slaService.ts`

**Functions:**
```typescript
// Calculate SLA deadlines based on lead creation
calculateSLADeadlines(leadCreatedAt: Date, leadType: string)

// Check current SLA status
checkSLAStatus(lead: ServiceLead): 'ON_TIME' | 'AT_RISK' | 'BREACHED'

// Update SLA status for all leads
updateSLAStatuses()

// Get time remaining until deadline
getTimeRemaining(deadline: Date): { minutes: number, status: string }
```

**Acceptance Criteria:**
- [ ] SLA deadlines calculated correctly
- [ ] Status updates automatically
- [ ] Timer updates in real-time on UI
- [ ] Works for all lead types

#### Task 1.3: Lead Accept/Reject API
**Estimated:** 2 days

**Files to Create:**
- `apps/web/src/app/api/leads/[id]/accept/route.ts`
- `apps/web/src/app/api/leads/[id]/reject/route.ts`

**API Specifications:**

**POST /api/leads/{id}/accept**
```typescript
Request: { workshop_id: string }
Response: { success: boolean, lead: ServiceLead, event: LeadEvent }
Validations:
  - User must be WORKSHOP_ADMIN
  - Lead must be ASSIGNED status
  - Lead must belong to user's workshop
  - SLA not breached
Actions:
  - Update status to ACCEPTED
  - Set accepted_at timestamp
  - Create lead_event
  - Trigger notification
```

**POST /api/leads/{id}/reject**
```typescript
Request: { reason: string, notes?: string }
Response: { success: boolean, lead: ServiceLead, event: LeadEvent }
Validations:
  - User must be WORKSHOP_ADMIN
  - Lead must be ASSIGNED status
  - Reason required (min 10 chars)
Actions:
  - Update status to REJECTED
  - Set rejected_at timestamp
  - Store rejection reason
  - Create lead_event
  - Trigger notification to Lead Manager
```

**Acceptance Criteria:**
- [ ] API endpoints working
- [ ] Validations enforced
- [ ] Events logged
- [ ] Notifications triggered
- [ ] Error handling complete

### Week 2: Lead Dashboard Enhancement

#### Task 1.4: Enhanced Lead List Dashboard
**Estimated:** 3 days

**Files to Modify:**
- `apps/web/src/app/dashboard/workshop_admin/page.tsx`
- `apps/web/src/components/LeadCard.tsx` (create)

**Features:**
- Lead cards with all required fields
- SLA indicator (color-coded)
- Time since creation ("7 minutes ago")
- Masked phone number (show on click)
- Quick actions (Accept/Reject/View)
- Real-time updates via Supabase Realtime

**Component Structure:**
```typescript
<LeadCard>
  <LeadHeader>
    Lead ID, Status Badge, SLA Indicator
  </LeadHeader>
  <LeadBody>
    Customer Info, Vehicle Info, Service Types
  </LeadBody>
  <LeadFooter>
    Quick Actions, Time Info, Priority Badge
  </LeadFooter>
</LeadCard>
```

**Acceptance Criteria:**
- [ ] All fields displayed correctly
- [ ] SLA indicator updates in real-time
- [ ] Phone masking works
- [ ] Click to view details works
- [ ] Filters working (NEW, ACCEPTED, etc.)
- [ ] Real-time updates functional

#### Task 1.5: Basic Lead Detail Page
**Estimated:** 4 days

**Files to Create:**
- `apps/web/src/app/dashboard/workshop_admin/leads/[id]/page.tsx`
- `apps/web/src/components/lead-detail/` (folder with components)

**Sections to Implement (MVP - 6 sections):**

1. **Lead Header**
   - Lead ID, Status, Created time, SLA countdown, Priority

2. **Customer Details**
   - Name, Phone (tap-to-call), Email, Address, Notes

3. **Vehicle Details**
   - Registration, Make/Model, Year, Fuel type

4. **Service Request**
   - Service types, Problem description, Estimated cost

5. **Scheduling & Pickup**
   - Preferred slot, Pickup required, Pickup status

6. **Admin Actions**
   - Accept, Reject, Assign Mechanic buttons

**Acceptance Criteria:**
- [ ] All 6 sections display correctly
- [ ] Data fetched from database
- [ ] Actions work (Accept/Reject)
- [ ] Phone tap-to-call works
- [ ] Responsive design
- [ ] Loading states handled

### Week 3: Status Workflow & Mobile App

#### Task 1.6: Status Workflow Implementation
**Estimated:** 2 days

**Status Transitions:**
```
NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED → CLOSED
                ↓
            REJECTED
```

**Files to Create:**
- `apps/web/src/lib/services/leadStatusService.ts`

**Functions:**
```typescript
canTransitionTo(currentStatus: string, newStatus: string, userRole: string): boolean
transitionStatus(leadId: string, newStatus: string, userId: string): Promise<ServiceLead>
getAvailableTransitions(currentStatus: string, userRole: string): string[]
```

**Acceptance Criteria:**
- [ ] Status transitions validated
- [ ] Only valid transitions allowed
- [ ] Role-based permissions enforced
- [ ] Events logged for each transition
- [ ] Notifications sent

#### Task 1.7: Mobile App Lead Dashboard
**Estimated:** 3 days

**Files to Create/Modify:**
- `apps/mobile/src/screens/workshop/WorkshopLeadsScreen.tsx` (enhance)
- `apps/mobile/src/components/LeadCard.tsx` (create)

**Features:**
- Lead list with cards
- Pull-to-refresh
- Accept/Reject actions
- Basic lead detail view
- SLA indicator

**Acceptance Criteria:**
- [ ] Lead list displays correctly
- [ ] Accept/Reject works
- [ ] Real-time updates
- [ ] Offline handling
- [ ] Performance optimized

#### Task 1.8: Real-time Lead Updates
**Estimated:** 2 days

**Implementation:**
- Supabase Realtime subscriptions
- WebSocket connections
- Push notifications (mobile)

**Files to Create:**
- `apps/web/src/hooks/useLeadRealtime.ts`
- `apps/mobile/src/hooks/useLeadRealtime.ts`

**Acceptance Criteria:**
- [ ] New leads appear instantly
- [ ] Status changes update in real-time
- [ ] SLA timer updates live
- [ ] Push notifications work
- [ ] Connection handling robust

### Week 4: Testing & Refinement

#### Task 1.9: Phase 1 Testing
**Estimated:** 3 days

**Test Coverage:**
- [ ] Unit tests for SLA service
- [ ] Integration tests for API endpoints
- [ ] E2E tests for lead workflow
- [ ] Performance testing
- [ ] Security testing (RBAC)

**Acceptance Criteria:**
- [ ] 80%+ code coverage
- [ ] All critical paths tested
- [ ] Performance benchmarks met
- [ ] Security validated

#### Task 1.10: Bug Fixes & Polish
**Estimated:** 2 days

**Focus Areas:**
- UI/UX improvements
- Error handling
- Loading states
- Edge cases
- Documentation

---

## Phase 2: Enhanced Features

**Duration:** 4-5 weeks  
**Priority:** HIGH  
**Goal:** Complete lead detail page, assignments, media, extra charges

### Week 5-6: Complete Lead Detail Page

#### Task 2.1: Remaining 6 Sections of Lead Detail Page
**Estimated:** 5 days

**Sections to Add:**

7. **Internal Assignment**
   - Assign mechanic dropdown
   - Assign pickup boy dropdown
   - Assign supervisor
   - Assignment history

8. **Job Card & Parts**
   - Create job card
   - Add parts list
   - Additional charges input
   - Approval workflow

9. **Media Section**
   - Upload images/videos
   - View customer media
   - Progress photos
   - Document upload

10. **Audit & Quality**
    - Audit requirement toggle
    - Audit status display
    - Auditor assignment

11. **Communication Logs**
    - System messages
    - Action history
    - Timestamps

12. **Service History**
    - Past leads for customer
    - Past services for vehicle
    - Ratings display

**Files to Create:**
- `apps/web/src/components/lead-detail/InternalAssignment.tsx`
- `apps/web/src/components/lead-detail/JobCardSection.tsx`
- `apps/web/src/components/lead-detail/MediaSection.tsx`
- `apps/web/src/components/lead-detail/AuditSection.tsx`
- `apps/web/src/components/lead-detail/CommunicationLogs.tsx`
- `apps/web/src/components/lead-detail/ServiceHistory.tsx`

**Acceptance Criteria:**
- [ ] All 12 sections complete
- [ ] Data fetched correctly
- [ ] Actions functional
- [ ] Responsive design
- [ ] Performance optimized

#### Task 2.2: Assignment System
**Estimated:** 4 days

**Features:**
- Assign mechanic from dropdown
- Assign pickup boy
- Assign supervisor
- View assignment history
- Reassign functionality

**API Endpoints:**
```
POST /api/leads/{id}/assign-mechanic
POST /api/leads/{id}/assign-pickup
POST /api/leads/{id}/assign-supervisor
GET  /api/leads/{id}/assignments
```

**Acceptance Criteria:**
- [ ] Assignment dropdowns populated
- [ ] Assignments saved to database
- [ ] Notifications sent
- [ ] History tracked
- [ ] Reassignment works

### Week 7: Media & Extra Charges

#### Task 2.3: Media Upload System
**Estimated:** 4 days

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS lead_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  media_type VARCHAR(20) NOT NULL, -- 'BEFORE', 'AFTER', 'PROGRESS', 'DOCUMENT'
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  uploaded_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Features:**
- Image/video upload
- Supabase Storage integration
- Media gallery view
- Delete functionality
- Progress indicators

**Files to Create:**
- `apps/web/src/components/MediaUpload.tsx`
- `apps/web/src/app/api/leads/[id]/media/route.ts`
- `apps/mobile/src/components/MediaUpload.tsx`

**Acceptance Criteria:**
- [ ] Upload works (web & mobile)
- [ ] Files stored in Supabase Storage
- [ ] Gallery displays correctly
- [ ] Delete functionality works
- [ ] File size validation
- [ ] Image compression (mobile)

#### Task 2.4: Extra Charges Management
**Estimated:** 3 days

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS lead_extra_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  requested_by UUID REFERENCES users_login(id),
  approved_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Features:**
- Request extra charges
- Add reason and image
- Customer approval workflow
- Update final invoice amount

**API Endpoints:**
```
POST /api/leads/{id}/extra-charge
GET  /api/leads/{id}/extra-charges
PUT  /api/leads/{id}/extra-charges/{charge_id}/approve
```

**Acceptance Criteria:**
- [ ] Extra charges can be added
- [ ] Approval workflow works
- [ ] Amount updates invoice
- [ ] Notifications sent
- [ ] History tracked

### Week 8: Job Card & Invoice

#### Task 2.5: Job Card System
**Estimated:** 3 days

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL UNIQUE REFERENCES service_leads(id),
  job_card_number VARCHAR(50) UNIQUE,
  parts_list JSONB,
  labor_charges DECIMAL(10,2),
  additional_work TEXT,
  created_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_card_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  part_name VARCHAR(255) NOT NULL,
  part_number VARCHAR(100),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Features:**
- Create job card
- Add parts list
- Calculate totals
- Generate job card number

**Acceptance Criteria:**
- [ ] Job card creation works
- [ ] Parts can be added
- [ ] Totals calculated correctly
- [ ] Job card number generated
- [ ] Print functionality

#### Task 2.6: Invoice Generation
**Estimated:** 4 days

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL UNIQUE REFERENCES service_leads(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  extra_charges DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'PENDING',
  payment_mode VARCHAR(50),
  generated_by UUID REFERENCES users_login(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Features:**
- Generate invoice
- Calculate totals
- PDF generation
- Email invoice
- Payment tracking

**Files to Create:**
- `apps/web/src/lib/services/invoiceService.ts`
- `apps/web/src/components/InvoiceGenerator.tsx`
- `apps/web/src/app/api/invoices/[id]/generate/route.ts`

**Acceptance Criteria:**
- [ ] Invoice generated correctly
- [ ] PDF created
- [ ] Email sent
- [ ] Payment tracking works
- [ ] Invoice number unique

### Week 9: Real-time Notifications & Polish

#### Task 2.7: Real-time Notification System
**Estimated:** 4 days

**Implementation:**
- Supabase Realtime for web
- Push notifications for mobile (Expo/FCM)
- In-app notification center

**Events to Handle:**
- New lead assigned
- Lead accepted/rejected
- Mechanic assigned
- Pickup assigned
- Repair started
- Extra charges requested
- Work completed
- SLA breached

**Files to Create:**
- `apps/web/src/lib/services/notificationService.ts`
- `apps/mobile/src/services/pushNotificationService.ts`
- `apps/web/src/components/NotificationCenter.tsx`

**Acceptance Criteria:**
- [ ] Web notifications work
- [ ] Mobile push notifications work
- [ ] Notification center displays
- [ ] Mark as read works
- [ ] Notification preferences

#### Task 2.8: Phase 2 Testing & Refinement
**Estimated:** 3 days

**Test Coverage:**
- [ ] Media upload tests
- [ ] Assignment tests
- [ ] Extra charges tests
- [ ] Invoice generation tests
- [ ] Notification tests

---

## Phase 3: Advanced Features

**Duration:** 3-4 weeks  
**Priority:** MEDIUM  
**Goal:** Audit system, reporting, analytics, optimization

### Week 10: Audit System

#### Task 3.1: Audit System Implementation
**Estimated:** 4 days

**Database Changes:**
```sql
CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES service_leads(id),
  auditor_id UUID REFERENCES users_login(id),
  audit_type VARCHAR(50), -- 'QUALITY', 'COMPLIANCE', 'CUSTOMER_SATISFACTION'
  score DECIMAL(3,2) CHECK (score >= 0 AND score <= 5),
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'COMPLETED', 'FAILED'
  audit_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id UUID NOT NULL REFERENCES audits(id),
  checklist_item VARCHAR(255) NOT NULL,
  checked BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Features:**
- Auto-trigger audit on completion
- Assign auditor
- Audit checklist
- Score calculation
- Audit remarks

**Acceptance Criteria:**
- [ ] Audit auto-triggers
- [ ] Auditor can be assigned
- [ ] Checklist works
- [ ] Score calculated
- [ ] Audit history tracked

### Week 11: Reporting & Analytics

#### Task 3.2: Reporting Dashboard
**Estimated:** 5 days

**Metrics to Display:**
- Average lead acceptance time
- Average repair time
- Pending pickups count
- Pending extra charges count
- Completed jobs count
- Audit pass rate
- 7-day performance stats
- 30-day performance stats

**Files to Create:**
- `apps/web/src/app/dashboard/workshop_admin/reports/page.tsx`
- `apps/web/src/components/reports/PerformanceChart.tsx`
- `apps/web/src/lib/services/reportingService.ts`

**Charts & Visualizations:**
- Acceptance time trend
- Repair time distribution
- Status breakdown pie chart
- Daily/weekly/monthly stats
- SLA compliance rate

**Acceptance Criteria:**
- [ ] All metrics calculated correctly
- [ ] Charts display properly
- [ ] Date range filters work
- [ ] Export functionality
- [ ] Performance optimized

### Week 12: Service History & Communication

#### Task 3.3: Service History Integration
**Estimated:** 3 days

**Features:**
- Past leads for customer
- Past services for vehicle
- Ratings display
- Complaint history
- Reopen count

**API Endpoints:**
```
GET /api/customers/{customer_id}/leads
GET /api/vehicles/{vehicle_number}/services
GET /api/customers/{customer_id}/ratings
```

**Acceptance Criteria:**
- [ ] Service history displays
- [ ] Data fetched correctly
- [ ] Ratings shown
- [ ] Complaint history visible

#### Task 3.4: Communication Logs Enhancement
**Estimated:** 2 days

**Features:**
- Chat integration (if available)
- Call log integration
- System message history
- Action timeline
- Export logs

**Acceptance Criteria:**
- [ ] All logs displayed
- [ ] Timeline accurate
- [ ] Export works
- [ ] Search functionality

### Week 13: Optimization & Final Testing

#### Task 3.5: Performance Optimization
**Estimated:** 3 days

**Optimizations:**
- Database query optimization
- Pagination for large lists
- Lazy loading for media
- Caching strategies
- Image compression
- Bundle size optimization

**Acceptance Criteria:**
- [ ] Page load < 2 seconds
- [ ] Smooth scrolling
- [ ] Efficient database queries
- [ ] Reduced bundle size

#### Task 3.6: Final Testing & Documentation
**Estimated:** 4 days

**Testing:**
- [ ] Full E2E testing
- [ ] Performance testing
- [ ] Security audit
- [ ] User acceptance testing
- [ ] Mobile app testing

**Documentation:**
- [ ] API documentation
- [ ] User guide
- [ ] Developer guide
- [ ] Deployment guide

---

## Database Schema Changes

### New Tables Required

1. **lead_events** - Event tracking
2. **lead_media** - Media files
3. **lead_extra_charges** - Extra charges
4. **job_cards** - Job card management
5. **job_card_parts** - Parts list
6. **invoices** - Invoice generation
7. **audits** - Audit system
8. **audit_checklist** - Audit checklist items

### Columns to Add to Existing Tables

**service_leads:**
- `sla_accept_deadline`
- `sla_assign_deadline`
- `sla_start_deadline`
- `sla_status`
- `accepted_at`
- `rejected_at`
- `rejected_reason`
- `assigned_mechanic_id`
- `assigned_pickup_boy_id`
- `assigned_supervisor_id`

### Indexes Required

```sql
CREATE INDEX idx_service_leads_workshop_status ON service_leads(workshop_id, status);
CREATE INDEX idx_service_leads_sla_status ON service_leads(sla_status);
CREATE INDEX idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX idx_lead_media_lead_id ON lead_media(lead_id);
CREATE INDEX idx_invoices_lead_id ON invoices(lead_id);
```

---

## API Endpoints Implementation

### Lead Management

```
GET    /api/workshops/{id}/leads?status=NEW
GET    /api/leads/{id}
POST   /api/leads/{id}/accept
POST   /api/leads/{id}/reject
POST   /api/leads/{id}/status
```

### Assignment

```
POST   /api/leads/{id}/assign-mechanic
POST   /api/leads/{id}/assign-pickup
POST   /api/leads/{id}/assign-supervisor
GET    /api/leads/{id}/assignments
```

### Media

```
POST   /api/leads/{id}/media
GET    /api/leads/{id}/media
DELETE /api/leads/{id}/media/{media_id}
```

### Extra Charges

```
POST   /api/leads/{id}/extra-charge
GET    /api/leads/{id}/extra-charges
PUT    /api/leads/{id}/extra-charges/{charge_id}/approve
```

### Job Card & Invoice

```
POST   /api/leads/{id}/job-card
GET    /api/leads/{id}/job-card
POST   /api/invoices/{id}/generate
GET    /api/invoices/{id}
```

### Events & History

```
GET    /api/leads/{id}/events
GET    /api/customers/{id}/leads
GET    /api/vehicles/{number}/services
```

---

## UI/UX Components

### Web Components

1. **LeadCard** - Lead list card component
2. **LeadDetailPage** - Complete 12-section detail page
3. **SLAIndicator** - SLA status indicator
4. **MediaUpload** - Media upload component
5. **AssignmentDropdown** - Staff assignment dropdown
6. **ExtraChargesForm** - Extra charges form
7. **JobCardForm** - Job card creation form
8. **InvoiceGenerator** - Invoice generation component
9. **NotificationCenter** - Notification display
10. **ReportsDashboard** - Reporting dashboard

### Mobile Components

1. **LeadCardMobile** - Mobile lead card
2. **LeadDetailMobile** - Mobile detail view
3. **MediaUploadMobile** - Mobile media upload
4. **AssignmentMobile** - Mobile assignment UI

---

## Testing Strategy

### Unit Tests
- SLA service functions
- Status transition logic
- Validation functions
- Calculation functions

### Integration Tests
- API endpoints
- Database operations
- Real-time subscriptions
- File uploads

### E2E Tests
- Complete lead workflow
- Accept/reject flow
- Assignment flow
- Media upload flow
- Invoice generation

### Performance Tests
- Page load times
- Database query performance
- Real-time update latency
- File upload performance

### Security Tests
- RBAC validation
- JWT token validation
- SQL injection prevention
- XSS prevention
- File upload security

---

## Timeline & Resource Allocation

### Phase 1: MVP (3-4 weeks)
- **Backend Developer:** 2 weeks
- **Frontend Developer:** 2 weeks
- **Mobile Developer:** 1 week
- **QA Engineer:** 1 week

### Phase 2: Enhanced (4-5 weeks)
- **Backend Developer:** 2 weeks
- **Frontend Developer:** 3 weeks
- **Mobile Developer:** 2 weeks
- **QA Engineer:** 1.5 weeks

### Phase 3: Advanced (3-4 weeks)
- **Backend Developer:** 1.5 weeks
- **Frontend Developer:** 2 weeks
- **Mobile Developer:** 1 week
- **QA Engineer:** 1 week
- **DevOps:** 0.5 weeks

### Total Resource Allocation
- **Backend:** 5.5 weeks
- **Frontend:** 7 weeks
- **Mobile:** 4 weeks
- **QA:** 3.5 weeks
- **DevOps:** 0.5 weeks

---

## Risk Management

### Technical Risks

1. **Real-time Performance**
   - Risk: WebSocket connections may impact performance
   - Mitigation: Implement connection pooling, optimize queries

2. **File Upload Size**
   - Risk: Large media files may cause issues
   - Mitigation: Implement compression, size limits, chunked uploads

3. **SLA Timer Accuracy**
   - Risk: Timer may drift or fail
   - Mitigation: Server-side validation, periodic sync

### Business Risks

1. **User Adoption**
   - Risk: Workshop admins may find UI complex
   - Mitigation: User testing, training, documentation

2. **Data Migration**
   - Risk: Existing data may need migration
   - Mitigation: Careful migration scripts, rollback plan

### Mitigation Strategies

- Regular code reviews
- Continuous testing
- Staging environment testing
- User feedback loops
- Performance monitoring
- Backup and recovery plans

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ Workshop Admin can accept/reject leads
- ✅ SLA timer displays correctly
- ✅ Basic lead detail page functional
- ✅ Status workflow working
- ✅ Mobile app basic functionality

### Phase 2 Success Criteria
- ✅ Complete 12-section lead detail page
- ✅ Media upload working
- ✅ Assignment system functional
- ✅ Extra charges management
- ✅ Invoice generation working

### Phase 3 Success Criteria
- ✅ Audit system operational
- ✅ Reporting dashboard complete
- ✅ Service history integrated
- ✅ Performance optimized
- ✅ All features tested and documented

---

## Next Steps

1. **Review & Approve Plan** - Stakeholder review
2. **Set Up Development Environment** - Dev, staging, production
3. **Create Project Board** - Task tracking (Jira/GitHub Projects)
4. **Kickoff Meeting** - Team alignment
5. **Start Phase 1** - Begin MVP development

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Ready for Development

