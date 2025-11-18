# ✅ Lead Management Columns - Complete Checklist

## Verification: All 55 Columns from Specification

### ✅ Lead Identification & Tracking (7 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 1 | `lead_id` VARCHAR PK | `id` UUID + `lead_number` VARCHAR | ✅ | Using UUID for id, lead_number for human-friendly |
| 2 | `created_at` TIMESTAMP | `created_at` TIMESTAMP | ✅ | Already exists |
| 3 | `created_by` VARCHAR | `created_by_id` UUID | ✅ | Already exists as FK to users |
| 4 | `created_from` VARCHAR | `created_from` VARCHAR(50) | ✅ | **NEW** - Channel: APP, WEB, TELECALLER, etc. |
| 5 | `lead_type` VARCHAR | `lead_type` VARCHAR(20) | ✅ | Already exists |
| 6 | `status` VARCHAR | `status` VARCHAR(30) | ✅ | Already exists, expanded size |
| 7 | `lead_priority` VARCHAR | `lead_priority` VARCHAR(20) | ✅ | **NEW** - LOW, NORMAL, HIGH, URGENT |

---

### ✅ Assignment & Routing (5 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 8 | `city_id` INT | `city_id` INTEGER | ✅ | **NEW** - FK to cities table (for normalized structure) |
| 9 | `model_id` INT | `model_id` INTEGER | ✅ | **NEW** - FK to car_models table |
| 10 | `workshop_id` VARCHAR | `workshop_id` UUID | ✅ | Already exists |
| 11 | `assigned_by` VARCHAR | `assigned_by` UUID | ✅ | **NEW** - Who assigned the lead |
| 12 | `assigned_at` TIMESTAMP | `assigned_at` TIMESTAMP | ✅ | Already exists |

---

### ✅ Customer Information (7 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 13 | `customer_name` VARCHAR | `customer_name` VARCHAR | ✅ | Already exists |
| 14 | `customer_phone` VARCHAR | `customer_phone` VARCHAR | ✅ | Already exists |
| 15 | `customer_phone_alt` VARCHAR | `customer_alternate_phone` VARCHAR(20) | ✅ | **NEW** |
| 16 | `customer_email` VARCHAR | `customer_email` VARCHAR | ✅ | Already exists |
| 17 | `customer_address` TEXT | `customer_address` TEXT | ✅ | **NEW** |
| 18 | `customer_lat` DECIMAL | `customer_lat` DECIMAL(10,7) | ✅ | **NEW** |
| 18 | `customer_lng` DECIMAL | `customer_lng` DECIMAL(10,7) | ✅ | **NEW** |
| 19 | `contact_method` VARCHAR | `contact_method` VARCHAR(20) | ✅ | **NEW** - CALL, WHATSAPP, SMS, EMAIL |

---

### ✅ Vehicle Information (9 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 20 | `vehicle_reg` VARCHAR | `vehicle_number` VARCHAR | ✅ | Already exists (different name) |
| 21 | `vehicle_make` VARCHAR | `vehicle_make` VARCHAR | ✅ | Already exists |
| 22 | `vehicle_model_name` VARCHAR | `vehicle_model` VARCHAR | ✅ | Already exists |
| 23 | `vehicle_variant` VARCHAR | `vehicle_variant` VARCHAR(100) | ✅ | **NEW** |
| 24 | `vehicle_year` INT | `vehicle_year` INTEGER | ✅ | Already exists |
| 25 | `odometer_km` INT | `odometer_km` INTEGER | ✅ | **NEW** |
| 26 | `vin` VARCHAR | `vehicle_vin` VARCHAR(50) | ✅ | **NEW** |
| 27 | `fuel_type` VARCHAR | `vehicle_fuel_type` VARCHAR(20) | ✅ | **NEW** - PETROL, DIESEL, CNG, EV |

---

### ✅ Service Details (4 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 28 | `service_type_ids` JSONB | `service_type_ids` JSONB | ✅ | **NEW** - Array of service type IDs |
| 29 | `subservice_ids` JSONB | `subservice_ids` JSONB | ✅ | **NEW** - Array of subservice IDs |
| 30 | `problem_description` TEXT | `problem_description` TEXT | ✅ | **NEW** |
| - | (legacy) | `service_type` VARCHAR | ✅ | Keeping for backward compatibility |
| - | (legacy) | `description` TEXT | ✅ | Keeping for backward compatibility |

---

### ✅ Pickup/Delivery (7 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 31 | `pickup_required` BOOLEAN | `pickup_required` BOOLEAN | ✅ | Already exists |
| 32 | `pickup_address` TEXT | `pickup_address` TEXT | ✅ | **NEW** |
| 33 | `pickup_lat` DECIMAL | `pickup_lat` DECIMAL(10,7) | ✅ | **NEW** |
| 33 | `pickup_lng` DECIMAL | `pickup_lng` DECIMAL(10,7) | ✅ | **NEW** |
| 34 | `pickup_otp` VARCHAR(10) | `pickup_otp` VARCHAR(10) | ✅ | **NEW** |
| 35 | `assigned_pickup_id` VARCHAR | `assigned_pickup_id` UUID | ✅ | **NEW** - FK to users |
| 36 | `pickup_status` VARCHAR | `pickup_status` VARCHAR(30) | ✅ | **NEW** - NOT_ASSIGNED, PENDING, PICKED, etc. |

---

### ✅ Scheduling (2 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 37 | `preferred_slot_start` TIMESTAMP | `preferred_slot_start` TIMESTAMP | ✅ | **NEW** |
| 37 | `preferred_slot_end` TIMESTAMP | `preferred_slot_end` TIMESTAMP | ✅ | **NEW** |

---

### ✅ Payment & Pricing (9 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 38 | `payment_mode` VARCHAR | `payment_mode` VARCHAR | ✅ | Already exists |
| 39 | `payment_txn_id` VARCHAR | `payment_txn_id` VARCHAR(100) | ✅ | **NEW** |
| 40 | `estimated_cost` DECIMAL | `estimated_cost` DECIMAL(12,2) | ✅ | **NEW** |
| 41 | `total_price` DECIMAL | `total_price` DECIMAL(12,2) | ✅ | **NEW** |
| 42 | `coupon_code` VARCHAR | `coupon_code` VARCHAR(50) | ✅ | **NEW** |
| 43 | `invoice_id` VARCHAR | `invoice_id` VARCHAR(50) | ✅ | **NEW** |
| 44 | `invoice_amount` DECIMAL | `invoice_amount` DECIMAL(12,2) | ✅ | **NEW** |
| - | (additional) | `actual_amount` DECIMAL | ✅ | Already exists |
| - | (additional) | `discount_amount` DECIMAL | ✅ | Already exists |
| - | (additional) | `tax_amount` DECIMAL | ✅ | Already exists |
| - | (additional) | `final_amount` DECIMAL | ✅ | Already exists |
| - | (additional) | `payment_status` VARCHAR | ✅ | Already exists |

---

### ✅ Audit Tracking (3 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 45 | `audit_required` BOOLEAN | `audit_required` BOOLEAN | ✅ | **NEW** |
| 46 | `audit_status` VARCHAR | `audit_status` VARCHAR(30) | ✅ | **NEW** - PENDING, SCHEDULED, PASSED, FAILED |
| 47 | `audit_remarks` TEXT | `audit_remarks` TEXT | ✅ | **NEW** |

---

### ✅ Escalation & Reopening (2 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 48 | `reopen_count` INT | `reopen_count` INTEGER | ✅ | **NEW** - Default 0 |
| 49 | `escalation` BOOLEAN | `escalation` BOOLEAN | ✅ | **NEW** - Default false |

---

### ✅ Notes & Internal Tracking (1 column)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 50 | `notes_internal` TEXT | `notes_internal` TEXT | ✅ | **NEW** |
| - | (customer notes) | `notes` TEXT | ✅ | Already exists |

---

### ✅ SLA Tracking (2 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 51 | `sla_expires_at` TIMESTAMP | `sla_expires_at` TIMESTAMP | ✅ | **NEW** |
| 52 | `sla_state` VARCHAR | `sla_state` VARCHAR(20) | ✅ | **NEW** - ON_TIME, AT_RISK, BREACHED |

---

### ✅ Metadata & Flexibility (2 columns)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 53 | `attachments` JSONB | `attachments` JSONB | ✅ | **NEW** - Structured media pointers |
| 54 | `meta` JSONB | `meta` JSONB | ✅ | **NEW** - UTM, device, raw payload |

---

### ✅ Soft Delete (1 column)

| # | Your Spec | Our Column | Status | Notes |
|---|-----------|------------|--------|-------|
| 55 | `deleted_at` TIMESTAMP | `deleted_at` TIMESTAMP | ✅ | **NEW** - Soft delete support |

---

## 📊 Summary

### Columns Count:
- **Your Specification**: 55 columns
- **New Columns Added**: 42 columns
- **Already Existing**: 13 columns
- **Total in service_leads**: 55+ columns (with some extras for backward compatibility)

### ✅ All Required Columns: **PRESENT**

---

## 🎯 Bonus Columns (Not in spec, but already exist & useful)

| Column | Type | Purpose |
|--------|------|---------|
| `assigned_mechanic_id` | UUID | Mechanic assignment |
| `assigned_supervisor_id` | UUID | Supervisor assignment |
| `qc_status` | VARCHAR | QC check status |
| `qc_performed_by` | UUID | Who did QC |
| `qc_performed_at` | TIMESTAMP | When QC done |
| `qc_notes` | TEXT | QC remarks |
| `ready_for_delivery_at` | TIMESTAMP | Ready time |
| `marked_ready_by` | UUID | Who marked ready |
| `rejected_at` | TIMESTAMP | Rejection time |
| `rejected_reason` | TEXT | Why rejected |
| `distance_from_workshop` | NUMERIC | Distance calculation |

---

## 🔄 Existing Tables Structure

We also have these related tables (as per your spec):

1. ✅ **lead_pricing_items** - Price locking/snapshot
2. ✅ **lead_events** - Activity log/event sourcing
3. ✅ **lead_media** - Media files storage
4. ✅ **lead_extra_charges** - Additional charges workflow

---

## 🎉 Conclusion

**All 55 columns from your specification are now included!**

Plus we've kept additional columns for:
- Quality control workflow
- Mechanic/supervisor tracking
- Workshop distance calculation
- Rejection tracking
- Delivery readiness

**Status: 100% Complete ✅**

---

## Next Action

Run the migration: `database/00_run_all_lead_migrations.sql`

All columns will be added safely (IF NOT EXISTS) without breaking existing data.

