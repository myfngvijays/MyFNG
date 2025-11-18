# 🎯 REMAINING USER ROLES - COMPLETE IMPLEMENTATION PLAN

## Status Overview

### ✅ Completed Roles (4/17):
1. ✅ **Super Admin** - Full system management
2. ✅ **Workshop Admin** - Workshop operations
3. ✅ **Workshop Supervisor** - Job assignment & QC
4. ✅ **Workshop Mechanic** - Repair execution
5. ✅ **Workshop Pickup Boy** - Vehicle pickup/delivery
6. ✅ **Auditor** - Database schema complete

### 🚧 In Progress (1/17):
7. 🚧 **Auditor** - Web dashboard in progress

### 📋 Remaining to Implement (10/17):
8. ⏳ **Accounts Team**
9. ⏳ **Lead Manager**
10. ⏳ **Customer Service Executive**
11. ⏳ **Telecaller**
12. ⏳ **RSA Manager**
13. ⏳ **Home Service Manager**
14. ⏳ **Company Mechanic (RSA)**
15. ⏳ **Company Van Technician**
16. ⏳ **Company Van Driver**
17. ⏳ **Customer** (End User)

---

## 📊 Implementation Priority Matrix

### **Tier 1 - Critical Business Operations** (Implement First)
Priority: HIGH | Impact: HIGH | Complexity: MEDIUM

#### 1. Auditor (80% Complete)
- [x] Database schema
- [ ] Web dashboard
- [ ] Audit detail page
- [ ] Mobile app
**Estimated Time:** 4 hours

#### 2. Accounts Team
**Purpose:** Financial management, invoicing, payments, settlements
**Estimated Time:** 8 hours
- [ ] Database schema (invoices, payments, refunds, settlements)
- [ ] Web dashboard (invoice management, payment tracking)
- [ ] Invoice generation & management
- [ ] Payment reconciliation
- [ ] Payout management

#### 3. Lead Manager
**Purpose:** Lead distribution and workshop assignment
**Estimated Time:** 6 hours
- [ ] Database schema (assignment rules, capacity management)
- [ ] Web dashboard (lead queue, workshop selection)
- [ ] Assignment algorithm
- [ ] Workshop capacity tracking
- [ ] Performance analytics

#### 4. Customer Service Executive
**Purpose:** Customer support, tickets, escalations
**Estimated Time:** 6 hours
- [ ] Database schema (tickets, escalations, communications)
- [ ] Web dashboard (ticket management, customer portal)
- [ ] Escalation workflow
- [ ] Communication logs
- [ ] Customer satisfaction tracking

---

### **Tier 2 - Enhanced Operations** (Implement Second)
Priority: MEDIUM | Impact: MEDIUM | Complexity: MEDIUM

#### 5. Telecaller
**Purpose:** Customer calls, followups, lead nurturing
**Estimated Time:** 5 hours
- [ ] Database schema (call logs, dispositions)
- [ ] Web dashboard (call queue, CRM)
- [ ] Dialer integration
- [ ] Call recording linkage
- [ ] Followup scheduler

#### 6. RSA Manager
**Purpose:** Roadside assistance operations management
**Estimated Time:** 7 hours
- [ ] Database schema (RSA jobs, mechanic assignment)
- [ ] Web dashboard (RSA queue, tracking)
- [ ] Real-time mechanic tracking
- [ ] Job dispatch system
- [ ] SLA management for RSA

---

### **Tier 3 - Specialized Services** (Implement Third)
Priority: MEDIUM | Impact: MEDIUM | Complexity: HIGH

#### 7. Home Service Manager
**Purpose:** Service-at-home operations (mobile van services)
**Estimated Time:** 8 hours
- [ ] Database schema (van schedules, service areas)
- [ ] Web dashboard (van tracking, scheduling)
- [ ] Route optimization
- [ ] Van capacity management
- [ ] Service area management

#### 8. Company Mechanic (RSA)
**Purpose:** Field mechanic for roadside assistance
**Estimated Time:** 6 hours
- [ ] Database schema (mechanic availability, tools)
- [ ] Mobile app (job acceptance, navigation)
- [ ] Real-time GPS tracking
- [ ] Service completion workflow
- [ ] Parts inventory (vehicle-based)

---

### **Tier 4 - Field Operations** (Implement Fourth)
Priority: LOW | Impact: LOW | Complexity: MEDIUM

#### 9. Company Van Technician
**Purpose:** Technician for service-at-home operations
**Estimated Time:** 5 hours
- [ ] Database schema (technician schedules, assignments)
- [ ] Mobile app (van-based service workflow)
- [ ] Service checklist system
- [ ] Parts tracking (van inventory)
- [ ] Customer signature capture

#### 10. Company Van Driver
**Purpose:** Driver for service vans
**Estimated Time:** 4 hours
- [ ] Database schema (driver logs, routes)
- [ ] Mobile app (navigation, van management)
- [ ] Route tracking
- [ ] Van maintenance logs
- [ ] Trip reports

---

### **Tier 5 - Customer Experience** (Implement Last)
Priority: HIGH (for business) | Impact: HIGH | Complexity: LOW

#### 11. Customer (End User)
**Purpose:** Customer portal and booking system
**Estimated Time:** 10 hours
- [ ] Database schema (bookings, preferences, history)
- [ ] Web portal (booking, tracking, history)
- [ ] Mobile app (easy booking, real-time tracking)
- [ ] Service catalog
- [ ] Payment integration
- [ ] Feedback system

---

## 📋 Detailed Implementation Breakdown

### **AUDITOR (Continue)**

#### Database: ✅ COMPLETE
- 8 tables created
- 4 functions implemented
- 3 triggers configured
- 2 views created
- RLS policies applied

#### Web Dashboard: 🚧 IN PROGRESS
**Files to Create:**
```
apps/web/src/app/dashboard/auditor/
├── page.tsx (Dashboard)
├── audits/
│   ├── page.tsx (Audit List)
│   └── [id]/
│       └── page.tsx (Audit Detail)
├── workshops/
│   └── page.tsx (Workshop Compliance)
├── certifications/
│   └── page.tsx (Certification Management)
└── performance/
    └── page.tsx (Auditor KPIs)
```

**Key Features:**
- Scheduled audits calendar
- Workshop compliance status grid
- Audit checklist with scoring
- Photo upload for evidence
- Action item management
- Certificate verification
- Performance metrics dashboard

---

### **ACCOUNTS TEAM**

#### Database Schema Required:

**Tables:**
1. `invoices` - Invoice generation and management
2. `invoice_items` - Line items for invoices
3. `payments` - Payment tracking
4. `payment_transactions` - Transaction logs
5. `refunds` - Refund processing
6. `settlements` - Workshop settlements
7. `expense_records` - Expense tracking
8. `financial_reports` - Generated reports

**Key Features:**
- Automatic invoice generation on job completion
- Multiple payment modes (Online, COD, UPI, Card, Wallet)
- Payment reconciliation
- Workshop payout calculations
- Commission tracking
- Tax calculations (GST)
- Refund processing
- Financial reporting

#### Web Dashboard:
```
apps/web/src/app/dashboard/accounts/
├── page.tsx (Dashboard - Revenue, Pending, Overdue)
├── invoices/
│   ├── page.tsx (Invoice List)
│   ├── [id]/page.tsx (Invoice Detail)
│   └── generate/page.tsx (Generate Invoice)
├── payments/
│   ├── page.tsx (Payment Tracking)
│   └── reconciliation/page.tsx (Bank Reconciliation)
├── refunds/
│   └── page.tsx (Refund Management)
├── settlements/
│   └── page.tsx (Workshop Settlements)
└── reports/
    └── page.tsx (Financial Reports)
```

---

### **LEAD MANAGER**

#### Database Schema Required:

**Tables:**
1. `lead_assignment_rules` - Auto-assignment rules
2. `workshop_capacity` - Real-time capacity tracking
3. `assignment_history` - Lead assignment audit
4. `workshop_performance` - Performance metrics per workshop
5. `lead_distribution_logs` - Assignment logs

**Key Features:**
- Smart lead distribution algorithm
- Workshop capacity management
- Manual assignment override
- Bulk assignment
- Workshop performance tracking
- SLA monitoring
- Load balancing
- Geographic assignment

#### Web Dashboard:
```
apps/web/src/app/dashboard/lead_manager/
├── page.tsx (Dashboard - Leads, Workshops, Distribution)
├── leads/
│   ├── page.tsx (Lead Queue)
│   ├── assign/page.tsx (Manual Assignment)
│   └── bulk-assign/page.tsx (Bulk Assignment)
├── workshops/
│   ├── page.tsx (Workshop List with Capacity)
│   └── [id]/page.tsx (Workshop Detail)
├── rules/
│   └── page.tsx (Assignment Rules Management)
└── analytics/
    └── page.tsx (Distribution Analytics)
```

---

### **CUSTOMER SERVICE EXECUTIVE**

#### Database Schema Required:

**Tables:**
1. `support_tickets` - Customer support tickets
2. `ticket_messages` - Ticket conversation thread
3. `escalations` - Escalated issues
4. `customer_communications` - All customer interactions
5. `canned_responses` - Pre-defined responses
6. `satisfaction_surveys` - Customer feedback

**Key Features:**
- Ticket management system
- Multi-channel support (Phone, Email, Chat, WhatsApp)
- Escalation workflow
- SLA tracking for responses
- Customer history view
- Canned responses
- Knowledge base integration
- Satisfaction tracking

#### Web Dashboard:
```
apps/web/src/app/dashboard/customer_service/
├── page.tsx (Dashboard - Tickets, Escalations, Satisfaction)
├── tickets/
│   ├── page.tsx (Ticket Queue)
│   ├── [id]/page.tsx (Ticket Detail & Chat)
│   └── create/page.tsx (Create Ticket)
├── escalations/
│   └── page.tsx (Escalation Management)
├── customers/
│   └── [id]/page.tsx (Customer 360 View)
└── reports/
    └── page.tsx (CS Metrics)
```

---

### **TELECALLER**

#### Database Schema Required:

**Tables:**
1. `call_logs` - All call records
2. `call_dispositions` - Call outcomes
3. `followup_schedule` - Scheduled callbacks
4. `lead_nurturing` - Lead warming campaigns
5. `call_recordings` - Recording metadata
6. `dialer_queue` - Auto-dialer queue

**Key Features:**
- Integrated dialer
- Call logging
- Disposition tracking
- Followup scheduler
- Lead nurturing campaigns
- Call recording access
- Script guidance
- Performance metrics

#### Web Dashboard:
```
apps/web/src/app/dashboard/telecaller/
├── page.tsx (Dashboard - Calls, Conversions, Followups)
├── call-queue/
│   └── page.tsx (Today's Calls)
├── leads/
│   ├── page.tsx (Lead List)
│   └── [id]/page.tsx (Lead Detail with Call)
├── followups/
│   └── page.tsx (Scheduled Followups)
└── performance/
    └── page.tsx (Call Metrics)
```

---

### **RSA MANAGER**

#### Database Schema Required:

**Tables:**
1. `rsa_jobs` - Roadside assistance jobs
2. `rsa_mechanics` - Available RSA mechanics
3. `rsa_assignments` - Job assignments
4. `rsa_equipment` - Tools and equipment tracking
5. `rsa_locations` - Service coverage areas
6. `rsa_sla_tracking` - Response time tracking

**Key Features:**
- Real-time job dispatch
- Mechanic availability tracking
- GPS-based assignment
- SLA monitoring (15-min, 30-min, 60-min)
- Live tracking
- Customer updates
- Equipment tracking
- Performance analytics

#### Web Dashboard:
```
apps/web/src/app/dashboard/rsa_manager/
├── page.tsx (Dashboard - Active Jobs, Available Mechanics)
├── jobs/
│   ├── page.tsx (RSA Job Queue)
│   ├── [id]/page.tsx (Job Tracking)
│   └── dispatch/page.tsx (Manual Dispatch)
├── mechanics/
│   ├── page.tsx (Mechanic Availability)
│   └── [id]/page.tsx (Mechanic Detail)
├── map/
│   └── page.tsx (Live Map View)
└── analytics/
    └── page.tsx (RSA Metrics)
```

---

### **HOME SERVICE MANAGER**

#### Database Schema Required:

**Tables:**
1. `service_vans` - Van fleet management
2. `van_schedules` - Daily schedules
3. `service_areas` - Coverage areas
4. `van_inventory` - Parts inventory per van
5. `van_routes` - Optimized routes
6. `technician_assignments` - Crew assignments

**Key Features:**
- Van fleet management
- Daily scheduling
- Route optimization
- Service area management
- Van inventory tracking
- Technician/driver pairing
- Customer scheduling
- Performance tracking

#### Web Dashboard:
```
apps/web/src/app/dashboard/home_service_manager/
├── page.tsx (Dashboard - Vans, Bookings, Routes)
├── vans/
│   ├── page.tsx (Fleet Management)
│   └── [id]/page.tsx (Van Detail & Schedule)
├── bookings/
│   ├── page.tsx (Booking Calendar)
│   └── [id]/page.tsx (Booking Detail)
├── routes/
│   └── page.tsx (Route Planning)
└── inventory/
    └── page.tsx (Van Inventory)
```

---

## 🎯 Quick Implementation Guide

### Step 1: Database First
For each role, create database migration file:
```bash
database/
├── 10_auditor_enhancements.sql ✅
├── 11_accounts_team_enhancements.sql
├── 12_lead_manager_enhancements.sql
├── 13_customer_service_enhancements.sql
├── 14_telecaller_enhancements.sql
├── 15_rsa_manager_enhancements.sql
├── 16_home_service_manager_enhancements.sql
├── 17_field_staff_enhancements.sql
└── 18_customer_portal_enhancements.sql
```

### Step 2: Web Dashboard
Create dashboard pages following the pattern:
```
apps/web/src/app/dashboard/{role}/
├── page.tsx (Main Dashboard)
├── layout.tsx (Role-specific layout)
└── [feature folders]
```

### Step 3: Mobile App
Create mobile screens:
```
apps/mobile/src/screens/dashboard/{role}/
└── [screens]
```

### Step 4: API Services
Create API services:
```
apps/web/src/lib/api/
└── {role}-service.ts
```

---

## 📊 Estimated Timeline

### Phase 1: Complete Auditor (Week 1)
- Days 1-2: Web dashboard & audit pages
- Days 3-4: Mobile app & testing
- Day 5: Documentation

### Phase 2: Financial & Operations (Week 2-3)
- Days 1-3: Accounts Team
- Days 4-6: Lead Manager
- Days 7-9: Customer Service Executive
- Day 10: Integration testing

### Phase 3: Sales & Support (Week 4)
- Days 1-3: Telecaller
- Days 4-7: Testing & refinement

### Phase 4: Specialized Services (Week 5-6)
- Days 1-4: RSA Manager
- Days 5-8: Home Service Manager
- Days 9-10: Testing

### Phase 5: Field Staff (Week 7)
- Days 1-3: Company Mechanic (RSA)
- Days 4-5: Van Technician & Driver
- Days 6-7: Testing

### Phase 6: Customer Portal (Week 8)
- Days 1-5: Customer booking & tracking
- Days 6-7: Final integration & testing

**Total Estimated Time: 8 weeks** (1 developer, full-time)

---

## 🚀 Quick Start Commands

### 1. Run Database Migrations
```bash
# Run in order
psql -U your_user -d your_database -f database/10_auditor_enhancements.sql
psql -U your_user -d your_database -f database/11_accounts_team_enhancements.sql
# ... and so on
```

### 2. Start Development
```bash
cd apps/web
npm run dev

# In another terminal
cd apps/mobile
npm start
```

### 3. Test Each Role
```bash
# Create test users for each role
npm run seed:test-users

# Run integration tests
npm run test:roles
```

---

## 📚 Documentation Plan

For each role, create:
1. `{ROLE}_COMPLETE.md` - Comprehensive guide
2. `{ROLE}_API.md` - API documentation
3. `{ROLE}_USER_GUIDE.md` - End-user training

---

## ✅ Definition of Done

For each role to be considered complete:
- [ ] Database schema created with all tables
- [ ] Indexes and foreign keys configured
- [ ] Functions and triggers implemented
- [ ] Row Level Security policies applied
- [ ] Web dashboard created
- [ ] All CRUD operations functional
- [ ] Mobile screens created (if applicable)
- [ ] API endpoints documented
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] User documentation completed
- [ ] Training guide created

---

## 🎓 Development Best Practices

### Database:
- Always use transactions
- Add proper indexes
- Use ENUM types for fixed values
- Implement RLS from start
- Add meaningful comments

### Frontend:
- Follow existing patterns
- Use TypeScript strictly
- Implement error boundaries
- Add loading states
- Use optimistic updates

### Mobile:
- Offline-first approach
- Optimize for slow networks
- Large touch targets
- Clear error messages
- Background sync ready

---

## 🔗 Integration Points

### Key Integrations:
1. **Payment Gateway** - Accounts Team
2. **SMS Gateway** - All notifications
3. **Email Service** - Customer communications
4. **WhatsApp API** - Customer Service
5. **Dialer API** - Telecaller
6. **Maps API** - RSA & Home Service
7. **Storage Service** - All media uploads

---

## 📊 Success Metrics

### By Role:
- **Auditor**: 100% workshops audited quarterly
- **Accounts**: 0 invoice errors, <2 day payment processing
- **Lead Manager**: <5 min average assignment time
- **Customer Service**: <2 hour first response, >4.5 satisfaction
- **Telecaller**: >30% call-to-lead conversion
- **RSA Manager**: <30 min average response time
- **Home Service**: >90% on-time arrival

---

**This plan provides a complete roadmap for implementing all remaining user roles in the MyFNG system.**

**Status**: Ready for execution  
**Last Updated**: November 17, 2025

