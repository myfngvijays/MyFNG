# 📊 Current Pricing Structure - MyFNG

## Overview
Yeh document current pricing structure ko explain karta hai.

---

## 🏗️ Pricing Tables Structure

### 1. **`service_types`** - Master Service Types
**Purpose:** Base service definitions with default prices

```sql
Columns:
- id (UUID)
- name (VARCHAR) - Service name
- description (TEXT)
- base_price (NUMERIC) - Default base price
- hsn_sac_code (VARCHAR) - Tax code
- default_tax_rate (NUMERIC) - Default tax rate (18%)
- is_active (BOOLEAN)
- created_at, updated_at
```

**Usage:** Yeh master services hain jo sabhi workshops ke liye available hain.

---

### 2. **`workshop_service_pricing`** - Workshop-Specific Pricing
**Purpose:** Individual workshops apne custom prices set kar sakte hain

```sql
Columns:
- id (UUID)
- workshop_id (UUID) - FK to workshops
- service_type_id (UUID) - FK to service_types
- custom_price (NUMERIC) - Workshop ka custom price
- zone_id (UUID) - Optional: Zone-specific pricing
- class (VARCHAR) - Optional: Vehicle class (HATCHBACK, SEDAN, SUV, etc.)
- is_active (BOOLEAN)
- created_at, updated_at

Unique Constraint: (workshop_id, service_type_id, zone_id, class)
```

**Pricing Logic:**
1. Agar workshop ne custom price set kiya hai → Use custom price
2. Agar custom price nahi hai → Use `service_types.base_price`

**Features:**
- ✅ Workshop-specific pricing
- ✅ Zone-wise pricing (optional)
- ✅ Vehicle class-wise pricing (optional)
- ✅ Super Admin manage kar sakta hai

---

### 3. **`workshop_service_addons_pricing`** - Addon Services Pricing
**Purpose:** Workshop-specific pricing for addon services

```sql
Columns:
- id (UUID)
- workshop_id (UUID) - FK to workshops
- service_addon_id (UUID) - FK to service_addons
- custom_price (NUMERIC)
- is_active (BOOLEAN)
- created_at, updated_at

Unique Constraint: (workshop_id, service_addon_id)
```

---

### 4. **`master_products`** - Parts & Consumables
**Purpose:** Master catalog of parts and consumables

```sql
Columns:
- id (UUID)
- name (VARCHAR)
- type (VARCHAR) - PART, LABOUR, CONSUMABLE
- category (VARCHAR)
- hsn_sac_code (VARCHAR)
- default_price (NUMERIC)
- tax_rate (NUMERIC) - Default 18%
- unit (VARCHAR) - pc, Ltr, Kg, etc.
- is_active (BOOLEAN)
- created_at, updated_at
```

---

### 5. **`workshop_product_pricing`** - Workshop Product Pricing
**Purpose:** Workshop-specific product prices

```sql
Columns:
- id (UUID)
- workshop_id (UUID)
- product_id (UUID) - FK to master_products
- selling_price (NUMERIC)
- stock_quantity (INTEGER)
- min_stock_level (INTEGER)
- class (VARCHAR) - Optional: Vehicle class
- zone_id (UUID) - Optional: Zone reference
- is_active (BOOLEAN)
- created_at, updated_at

Unique Constraint: (workshop_id, product_id)
```

---

### 6. **`lead_pricing_items`** - Locked Pricing (Immutable)
**Purpose:** Lead create hone par prices lock ho jate hain (audit trail)

```sql
Columns:
- id (UUID)
- lead_id (UUID) - FK to service_leads
- service_type_id (INTEGER)
- subservice_id (INTEGER)
- item_name (VARCHAR)
- base_price (NUMERIC)
- final_price (NUMERIC)
- qty (INTEGER)
- discount_percentage (NUMERIC)
- tax_percentage (NUMERIC)
- is_addon (BOOLEAN)
- status (VARCHAR) - ACTIVE, CANCELLED, REPLACED
- created_at, updated_at
```

**Important:** Yeh table immutable hai - lead create hone ke baad prices change nahi ho sakte (audit ke liye).

---

## 🔄 Pricing Flow

### Service Pricing Flow:
```
1. Customer selects service
   ↓
2. System checks: workshop_service_pricing (workshop_id + service_type_id + zone_id + class)
   ↓
3. If found → Use custom_price
   If not found → Use service_types.base_price
   ↓
4. Lead create → Prices lock in lead_pricing_items
   ↓
5. Invoice generate → Use locked prices
```

### Product Pricing Flow:
```
1. Mechanic adds part to job card
   ↓
2. System checks: workshop_product_pricing (workshop_id + product_id)
   ↓
3. If found → Use selling_price
   If not found → Use master_products.default_price
   ↓
4. Job card locked → Prices immutable
```

---

## 🎯 Pricing Hierarchy

### Service Pricing:
1. **Highest Priority:** `workshop_service_pricing.custom_price` (with zone + class)
2. **Fallback:** `service_types.base_price`

### Product Pricing:
1. **Highest Priority:** `workshop_product_pricing.selling_price`
2. **Fallback:** `master_products.default_price`

---

## 📍 Zone & Class Support

### Current Structure:
- ✅ **Zone Support:** `workshop_service_pricing.zone_id` (optional)
- ✅ **Class Support:** `workshop_service_pricing.class` (optional)
- ✅ **Combination:** Zone + Class + Workshop = Unique pricing

### Example:
```sql
-- Same service, different prices:
Workshop A + Zone North + Class SUV = ₹1000
Workshop A + Zone North + Class HATCHBACK = ₹800
Workshop A + Zone South + Class SUV = ₹1200
```

---

## 👥 Who Can Manage Pricing?

### Super Admin:
- ✅ Manage `workshop_service_pricing` (all workshops)
- ✅ Manage `master_products`
- ✅ Manage `service_types.base_price`
- ✅ Bulk operations (zone-wise, class-wise)

### Workshop Admin:
- ✅ Manage own workshop's `workshop_service_pricing`
- ✅ Manage own workshop's `workshop_product_pricing`
- ❌ Cannot modify master prices

---

## 📊 Current UI Pages

### Super Admin:
1. **Service Pricing** (`/dashboard/super_admin/inventory/service-pricing`)
   - Zone → Class → Workshop selection
   - Bulk pricing operations
   - Individual workshop pricing

2. **Product Pricing** (`/dashboard/super_admin/inventory/pricing`)
   - Workshop product prices
   - Stock management

### Workshop Admin:
- Manage own workshop pricing
- Set custom prices for services
- Set custom prices for products

---

## 🔍 Key Features

### ✅ Implemented:
- Workshop-specific pricing
- Zone-wise pricing (optional)
- Vehicle class-wise pricing (optional)
- Master product catalog
- Immutable pricing lock (lead_pricing_items)
- Tax calculation support
- HSN/SAC code tracking

### ❌ Not Implemented:
- ~~Website customer-facing pricing~~ (dropped)
- City-wise pricing (only zone-wise)
- Dynamic pricing based on demand
- Seasonal pricing

---

## 📝 Notes

1. **Pricing is Workshop-Centric:** Har workshop apne prices set kar sakta hai
2. **Zone & Class are Optional:** Agar set nahi kiya to default price use hota hai
3. **Prices Lock on Lead Creation:** Lead create hone ke baad prices change nahi ho sakte
4. **Super Admin has Full Control:** Sabhi workshops ke prices manage kar sakta hai

---

**Last Updated:** Current structure as of now
