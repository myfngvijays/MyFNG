# 🚗 Lead Management System - Complete Structure

## Overview
This document explains the complete lead management system structure, tables, and workflow.

---

## 📊 Database Tables

### 1. **service_leads** (Core Lead Table)
Main table that stores all service lead information.

#### Key Columns:

**Lead Identification**
- `id` - UUID primary key
- `lead_number` - Human-friendly ID (e.g., L-000123)
- `created_at` - When lead was created
- `created_by_id` - Who created it
- `created_from` - Channel: APP, WEB, TELECALLER, GMB, WHATSAPP, PARTNER, IMPORT
- `lead_type` - Type: NORMAL, RSA, HOME_SERVICE
- `lead_priority` - Priority: LOW, NORMAL, HIGH, URGENT

**Status & Assignment**
- `status` - Current status: NEW, ACCEPTED, REJECTED, ASSIGNED, IN_PROGRESS, READY_FOR_DELIVERY, DELIVERED, CLOSED, HOLD
- `workshop_id` - Assigned workshop
- `assigned_to_id` - Assigned workshop admin
- `assigned_mechanic_id` - Assigned mechanic
- `assigned_supervisor_id` - Assigned supervisor
- `assigned_pickup_id` - Assigned pickup boy

**Customer Information**
- `customer_name` - Customer full name
- `customer_phone` - Primary phone
- `customer_alternate_phone` - Secondary phone
- `customer_email` - Email address
- `customer_address` - Full address
- `customer_lat`, `customer_lng` - GPS coordinates
- `contact_method` - Preferred: CALL, WHATSAPP, SMS, EMAIL

**Vehicle Information**
- `vehicle_number` - Registration number
- `vehicle_make` - Brand (e.g., Maruti)
- `vehicle_model` - Model name
- `vehicle_variant` - Variant details
- `vehicle_year` - Manufacturing year
- `vehicle_vin` - VIN number
- `vehicle_fuel_type` - PETROL, DIESEL, CNG, EV
- `odometer_km` - Current odometer reading

**Service Details**
- `service_type` - Main service type (legacy)
- `service_type_ids` - JSONB array of service type IDs
- `subservice_ids` - JSONB array of subservice IDs
- `description` - Service description
- `problem_description` - Detailed problem description

**Pickup/Delivery**
- `pickup_required` - Boolean flag
- `pickup_address` - Pickup location
- `pickup_lat`, `pickup_lng` - Pickup GPS
- `pickup_status` - NOT_ASSIGNED, PENDING, PICKED, IN_TRANSIT, DROPPED
- `pickup_otp` - OTP for verification
- `preferred_slot_start`, `preferred_slot_end` - Preferred time window

**Payment & Pricing**
- `estimated_cost` - Initial estimate
- `actual_amount` - Final amount before taxes
- `total_price` - Total with taxes and extras
- `discount_amount` - Discount applied
- `tax_amount` - Tax amount
- `final_amount` - Final payable amount
- `payment_mode` - ONLINE, COD, WALLET
- `payment_status` - PENDING, PAID, PARTIAL
- `payment_txn_id` - Transaction reference
- `coupon_code` - Applied coupon
- `invoice_id` - Invoice reference
- `invoice_amount` - Invoice total

**Quality & Audit**
- `qc_status` - QC check status
- `qc_performed_by` - Who did QC
- `qc_performed_at` - When QC was done
- `qc_notes` - QC remarks
- `audit_required` - Needs audit?
- `audit_status` - PENDING, SCHEDULED, PASSED, FAILED
- `audit_remarks` - Audit comments

**SLA & Escalation**
- `sla_expires_at` - SLA deadline
- `sla_state` - ON_TIME, AT_RISK, BREACHED
- `escalation` - Escalated flag
- `reopen_count` - How many times reopened

**Internal Tracking**
- `notes` - Customer-visible notes
- `notes_internal` - Internal team notes
- `attachments` - JSONB metadata for files
- `meta` - JSONB for flexible data (UTM, device info, etc.)
- `deleted_at` - Soft delete timestamp

---

### 2. **lead_pricing_items** (Pricing Snapshot)
Immutable record of locked prices for each service/item.

**Purpose:** Once a lead is created, prices are locked here for audit and invoicing.

#### Columns:
- `id` - UUID primary key
- `lead_id` - FK to service_leads
- `service_type_id` - Reference to service type
- `subservice_id` - Reference to subservice
- `item_name` - Display name
- `item_description` - Details
- `base_price` - Original price
- `final_price` - Price after discount
- `qty` - Quantity
- `discount_percentage` - Discount %
- `tax_percentage` - Tax %
- `is_addon` - True if added during service
- `status` - ACTIVE, CANCELLED, REPLACED
- `added_by` - Who added this item
- `locked_at` - When price was locked
- `created_at`, `updated_at` - Timestamps

**Use Cases:**
- Generate accurate invoices
- Track price changes over time
- Audit trail for pricing
- Handle add-ons during service

---

### 3. **lead_events** (Activity Log)
Event sourcing table - every action creates an event.

#### Columns:
- `id` - UUID primary key
- `lead_id` - FK to service_leads
- `event_type` - Specific event (e.g., `lead_created`, `status_changed`, `sla_breached`)
- `event_category` - Broad category: LEAD, ASSIGNMENT, STATUS, PAYMENT, SLA, AUDIT
- `actor` - Who did it: `user:UUID`, `system`, `customer`, `partner:ID`
- `actor_name` - Display name
- `actor_role` - User role
- `event_description` - Human-readable description
- `metadata` - JSONB with event details (old_value, new_value, etc.)
- `ip_address` - IP of action
- `user_agent` - Browser/device info
- `created_at` - Timestamp

**Event Types Examples:**
- `lead_created` - New lead
- `lead_accepted` - Workshop accepted
- `lead_rejected` - Workshop rejected
- `status_changed` - Status updated
- `mechanic_assigned` - Mechanic assigned
- `pickup_scheduled` - Pickup arranged
- `payment_received` - Payment confirmed
- `sla_breached` - SLA missed
- `escalated` - Lead escalated
- `audit_completed` - Audit done

---

### 4. **lead_media** (Media Files)
All photos, videos, documents related to leads.

#### Columns:
- `id` - UUID primary key
- `lead_id` - FK to service_leads
- `media_type` - Type: image, video, document, pdf
- `category` - Category for organization
- `file_url` - Storage URL
- `thumbnail_url` - Thumbnail (for videos)
- `title` - Display title
- `description` - Optional description
- `latitude`, `longitude` - GPS where taken
- `uploaded_by` - Who uploaded
- `is_deleted` - Soft delete flag
- `created_at` - Upload timestamp

**Categories:**
- `customer_before` - Customer photos before service
- `workshop_before` - Workshop photos at intake
- `workshop_progress` - During service
- `workshop_after` - After service completion
- `audit` - Audit photos
- `invoice` - Invoice documents
- `other` - Miscellaneous

---

### 5. **lead_extra_charges** (Additional Charges)
Extra charges discovered during service that need approval.

#### Columns:
- `id` - UUID primary key
- `lead_id` - FK to service_leads
- `description` - What needs to be charged
- `amount` - Charge amount
- `reason` - Why needed
- `category` - PARTS, LABOR, CONSUMABLES, EMERGENCY, OTHER
- `attachment_url` - Photo evidence
- `status` - PENDING, APPROVED, REJECTED
- `requested_by` - Mechanic/supervisor who requested
- `approved_by` - Workshop admin who approved
- `supervisor_approved_by` - Supervisor approval
- `customer_approved` - Customer consent
- `customer_approved_at` - When customer agreed
- `rejection_reason` - Why rejected
- `is_urgent` - Urgent flag
- `created_at` - When requested

**Workflow:**
1. Mechanic finds extra work needed
2. Takes photo of issue
3. Requests extra charge with reason
4. Supervisor reviews and approves
5. Workshop admin final approval
6. Customer consent (if required)
7. Added to invoice

---

## 🔄 Lead Flow / Lifecycle

```
1. Lead Creation
   ↓
2. Assignment to Workshop
   ↓
3. Workshop Acceptance/Rejection
   ↓
4. Mechanic Assignment
   ↓
5. Pickup (if required)
   ↓
6. Work in Progress
   ├→ Extra charges (if needed)
   ├→ Progress updates
   └→ Photos uploaded
   ↓
7. QC Check by Supervisor
   ↓
8. Ready for Delivery
   ↓
9. Delivery/Drop
   ↓
10. Payment Collection
   ↓
11. Audit (if required)
   ↓
12. Closed
```

---

## 📋 Status Flow

### Main Status Enum:
- **NEW** - Just created, not assigned
- **ASSIGNED** - Assigned to workshop, awaiting acceptance
- **ACCEPTED** - Workshop accepted the lead
- **REJECTED** - Workshop rejected (can reassign)
- **IN_PROGRESS** - Work started
- **READY_FOR_DELIVERY** - QC passed, ready to return
- **DELIVERED** - Vehicle returned to customer
- **HOLD** - Temporarily paused (customer request, parts delay, etc.)
- **CLOSED** - Completed and paid

---

## 🎯 Priority Levels

- **LOW** - Can be done later
- **NORMAL** - Standard priority
- **HIGH** - Important, should be prioritized
- **URGENT** - Emergency, immediate attention needed

---

## 📞 Source Channels (created_from)

- **APP** - Mobile app customer
- **WEB** - Website booking
- **TELECALLER** - Phone call booking
- **GMB** - Google My Business
- **WHATSAPP** - WhatsApp chat
- **PARTNER** - Partner workshop/dealer
- **IMPORT** - Bulk imported data

---

## 🔐 SLA States

- **ON_TIME** - Within SLA
- **AT_RISK** - Approaching deadline
- **BREACHED** - SLA missed

---

## 💾 JSONB Fields Usage

### service_type_ids
```json
[1, 3, 7]
```
Array of service type IDs selected for this lead.

### subservice_ids
```json
[12, 15, 23, 45]
```
Array of subservice IDs.

### attachments
```json
{
  "customer_docs": ["url1", "url2"],
  "insurance": "url3"
}
```

### meta
```json
{
  "utm_source": "google",
  "utm_campaign": "summer_sale",
  "device": "mobile",
  "app_version": "2.1.0",
  "ip": "103.x.x.x"
}
```

---

## 🚀 Next Steps

1. **Run the migration**: Execute `00_run_all_lead_migrations.sql` in Supabase
2. **Update frontend**: Update lead creation forms to use new fields
3. **Update APIs**: Modify backend to populate new columns
4. **Test flow**: Create test leads and verify all stages work
5. **Add validations**: Implement business rules and constraints

---

## 📞 Questions?

Contact the development team for clarification on any table structure or workflow.

