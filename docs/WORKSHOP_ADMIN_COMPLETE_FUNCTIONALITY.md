# 🚀 MYFNG — WORKSHOP ADMIN COMPLETE FUNCTIONALITY (FINAL MASTER DOCUMENT)

**Detailed, Step-by-Step, with Full Descriptions**

---

## Table of Contents

1. [Lead Creation Flow](#1-lead-creation-flow)
2. [Workshop Dashboard (Lead List Screen)](#2-workshop-dashboard-lead-list-screen)
3. [Full Lead Detail Page](#3-full-lead-detail-page-complete-information-layout)
4. [Full Status Workflow](#4-full-status-workflow)
5. [SLA Rules (Time Based)](#5-sla-rules-time-based)
6. [Notifications & Events (Real-Time System)](#6-notifications--events-real-time-system)
7. [Validations Before Accepting Lead](#7-validations-before-accepting-lead)
8. [Database Tables (Core Lead & Pricing Structure)](#8-database-tables-core-lead--pricing-structure)
9. [API Endpoints (Developer Ready)](#9-api-endpoints-developer-ready)
10. [UI/UX Best Practices](#10-uiux-best-practices)
11. [Reporting & Insights](#11-reporting--insights)

---

## 1. Lead Creation Flow

### When a New Lead Arrives

A lead is created from different sources:

- **Mobile App**
- **Website**
- **Telecaller**
- **CSV Import**
- **Partner referral**

System tags the lead with `lead_type = NORMAL / RSA / HOME_SERVICE`.

**Important:** Workshop Admin dashboard only shows **NORMAL SERVICE LEADS**.

### System Actions After Lead Creation

1. A new row added in `leads` table.
2. **SLA timer inserted** (e.g., lead must be accepted within 20 minutes).
3. System triggers `new_lead_assigned_to_workshop` event.
4. **Push notification sent** to all workshop admins for that workshop.
5. Lead appears in dashboard **in real-time**.

---

## 2. Workshop Dashboard (Lead List Screen)

### Overview

Workshop Admin sees all current incoming leads in **card format**.

### Each Lead Card Shows

- **Lead ID**
- **Created time** (e.g., "7 minutes ago")
- **Customer Name**
- **Masked phone number** (show only last 4 digits)
- **Vehicle number**
- **Vehicle make/model**
- **Service type(s)** selected by customer
- **Priority** (Normal / High / Urgent)
- **Pickup required** or not
- **Preferred service slot**
- **Distance** from customer to workshop
- **Status** (NEW / ACCEPTED / ASSIGNED / IN_PROGRESS / COMPLETED)
- **SLA indicator:**
  - 🟢 **Green:** On Time
  - 🟡 **Yellow:** At Risk
  - 🔴 **Red:** Breached

### Quick Actions on Card

- **ACCEPT** → Move lead to next stage
- **REJECT** → Open reason modal
- **VIEW DETAILS** → Open full lead detail page

### Card Behaviors

- Clicking anywhere opens detailed lead view.
- Phone details become visible only on click for privacy.

---

## 3. Full Lead Detail Page (Complete Information Layout)

**This is the MOST IMPORTANT screen.**

All details are organized into **12 sections**.

### A. Lead Header (Top Bar)

Shows:

- Lead ID
- Current status
- Lead created time
- **SLA countdown** (in minutes)
- Lead priority
- Color-coded SLA indicator

### B. Customer Details

- Customer name
- Primary phone (tap-to-call)
- Alternate phone
- Email
- Full address
- Google maps coordinates (lat/lng)
- Preferred communication method (Call / WhatsApp / SMS)
- Special notes added by customer

### C. Vehicle Details

- Vehicle registration number
- Make, model, variant
- Year
- Odometer reading
- VIN
- Fuel type (Petrol / Diesel / CNG / EV)

### D. Service Request Details (From Backend)

This includes service types & add-ons coming from:

- City-wise & model-wise filters
- Workshop pricing
- Add-ons (Oil type, AC gas, brake cleaning, etc.)

**Shown to Workshop Admin:**

- Main service types selected
- Add-ons/subservices selected
- Problem description
- Payment mode
- Estimated cost (if auto-generated)
- Coupon applied
- Final pricing details

### E. Scheduling & Pickup Section

- Preferred date & time slot
- Whether pickup is required
- Pickup address (if different)
- Pickup OTP
- Assigned pickup boy
- Pickup status:
  - NOT ASSIGNED
  - PENDING
  - PICKED
  - IN TRANSIT
  - DROPPED

### F. Internal Assignment

Handles internal workshop workflows:

- Assigned workshop
- Assigned mechanic
- Assigned supervisor
- Assigned pickup agent
- Assignment timestamps
- Assigned by (which admin)

### G. Job Card & Parts Section

Once accepted, workshop admin can manage:

- Job card ID
- List of required parts
- Additional charges requested
- Approvals for extra work
- Final invoice amount
- Invoice number

### H. Media Section (Before / After / Progress)

Shows all images & videos:

- Customer uploaded media (before service)
- Workshop uploaded inspection images
- Progress images
- Final "after work" images
- Audit photos
- Documents (insurance, RC, etc.)

### I. Audit & Quality Section

- Audit requirement (Yes/No)
- Audit status
- Auditor name
- Audit remarks

**Note:** Audit triggers automatically when work is completed.

### J. Communication Logs

- Chat history (if chat module integrated)
- System messages (lead created, reassigned, completed)
- Call logs (if dialer integrated)
- Timestamps for every action

### K. Service History

Shows:

- Past leads of this customer
- Past service records of this car
- Ratings
- Previous complaints
- Reopen count

### L. Admin Actions (Based on Role Permissions)

The Workshop Admin can:

- ✅ Accept lead
- ✅ Reject lead
- ✅ Assign mechanic
- ✅ Assign pickup
- ✅ Upload media
- ✅ Request extra charges
- ✅ Start repair (IN_PROGRESS)
- ✅ Mark job as completed
- ✅ Schedule audit
- ✅ Create invoice
- ✅ Escalate to MyFNG team

**RBAC (Role-Based Access Control)** ensures only authorized users can perform certain actions.

---

## 4. Full Status Workflow

This is the lifecycle of a lead:

### Primary Flow

1. **NEW**
2. **ACCEPTED**
3. **ASSIGNED**
4. **IN_PROGRESS**
5. **READY FOR DELIVERY**
6. **DELIVERED**
7. **CLOSED**

### Alternative Flow

- **NEW** → **REJECTED** (back to lead manager)

---

## 5. SLA Rules (Time Based)

Each stage has a timer. Example:

- Accept within **20 mins**
- Assign mechanic within **30 mins** after acceptance
- Repair start within **2 hours**

If expired → SLA status updated:

- **ON_TIME**
- **AT_RISK**
- **BREACHED**

System triggers escalation event `lead_sla_breached`.

---

## 6. Notifications & Events (Real-Time System)

### Trigger Events Sent To

- Customer
- Pickup boy
- Mechanic
- Supervisor
- Admin panel

### Events Include

- Lead accepted
- Lead rejected
- Mechanic assigned
- Pickup assigned
- Repair started
- Extra charges requested
- Media uploaded
- Work completed
- Invoice generated
- SLA breached

---

## 7. Validations Before Accepting Lead

System checks:

- ✅ Valid phone
- ✅ Vehicle registration present
- ✅ Valid date/time slot
- ✅ If pickup selected → coordinates must exist
- ✅ If pre-paid → payment reference must exist
- ✅ Extra charges > threshold → require image + reason

---

## 8. Database Tables (Core Lead & Pricing Structure)

Your system uses a **professional scalable architecture**.

### A. Lead Table (Main)

Stores every detail of a lead.

### B. Service Architecture Tables

1. `service_categories`
2. `service_types`
3. `service_subservices`
4. `workshop_service_pricing`
5. `workshop_service_addons_pricing`

### C. Price Lock Table

`lead_pricing_items` — locks prices at lead creation.

### D. Support Tables

- Job card
- Extra charges
- Media
- Audit
- Chat logs
- Events

All linked via foreign keys.

---

## 9. API Endpoints (Developer Ready)

### Leads

```
POST   /api/leads
GET    /api/leads/{lead_id}
GET    /api/workshops/{id}/leads?status=NEW
```

### Lead Actions

```
POST   /api/leads/{lead_id}/accept
POST   /api/leads/{lead_id}/reject
POST   /api/leads/{lead_id}/assign
POST   /api/leads/{lead_id}/status
POST   /api/leads/{lead_id}/media
POST   /api/leads/{lead_id}/extra-charge
GET    /api/leads/{lead_id}/events
```

### Security

All endpoints validate **JWT + user role**.

---

## 10. UI/UX Best Practices

- ✅ Status colors (green/amber/red)
- ✅ Phone tap-to-call
- ✅ Hide sensitive data until clicked
- ✅ "Start Repair" should mark IN_PROGRESS with timestamp
- ✅ Show "previous services" quick button
- ✅ Show time since lead created
- ✅ Bulk accept
- ✅ Easy filters: NEW, ACCEPTED, IN PROGRESS, COMPLETED

---

## 11. Reporting & Insights

Workshop Admin can view metrics:

- Average lead acceptance time
- Average repair time
- Pending pickups
- Pending extra charges
- Completed jobs
- Audit pass rate
- **7 & 30 day performance stats**

---

## Implementation Priority

### Phase 1: Core Functionality (MVP)
1. Lead list dashboard with cards
2. Basic lead detail page
3. Accept/Reject functionality
4. Status workflow (NEW → ACCEPTED → IN_PROGRESS → COMPLETED)
5. Basic SLA timer

### Phase 2: Enhanced Features
1. Full 12-section lead detail page
2. Media upload
3. Assignment to mechanics/pickup boys
4. Extra charges management
5. Real-time notifications

### Phase 3: Advanced Features
1. Audit system
2. Invoice generation
3. Communication logs
4. Service history
5. Reporting & analytics

---

## Technical Notes

### Real-Time Updates
- Use Supabase Realtime subscriptions for live lead updates
- WebSocket connections for instant notifications
- Push notifications via Expo/FCM for mobile

### Performance Optimization
- Pagination for lead lists
- Lazy loading for media
- Caching for frequently accessed data
- Indexed database queries

### Security Considerations
- Role-based access control (RBAC)
- JWT token validation
- Data encryption for sensitive information
- Audit logging for all actions

---

## Development Checklist

- [ ] Lead creation flow implementation
- [ ] Workshop dashboard with lead cards
- [ ] Full lead detail page (12 sections)
- [ ] Accept/Reject functionality
- [ ] Status workflow implementation
- [ ] SLA timer and tracking
- [ ] Real-time notifications
- [ ] Media upload functionality
- [ ] Assignment system (mechanic/pickup)
- [ ] Extra charges management
- [ ] Job card creation
- [ ] Invoice generation
- [ ] Audit system integration
- [ ] Communication logs
- [ ] Service history display
- [ ] Reporting dashboard
- [ ] API endpoints implementation
- [ ] Mobile app integration
- [ ] Web app integration
- [ ] Testing and QA

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Master Reference Document for Development

