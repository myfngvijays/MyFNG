# Telecaller Lead Creation - Requirements Analysis

## 📋 Current Status vs Requirements

### ✅ ALREADY IMPLEMENTED (No Changes Needed)

#### Customer Details
- ✅ customer_name (text input)
- ✅ customer_phone (10-digit validation)
- ✅ customer_alternate_phone (optional)
- ✅ customer_email (optional)
- ✅ customer_address (text input)
- ✅ contact_method (dropdown: CALL, WHATSAPP, SMS, EMAIL)

#### Vehicle Details
- ✅ vehicle_number (vehicle_reg equivalent)
- ✅ vehicle_make (text input - NEEDS CHANGE to dropdown)
- ✅ vehicle_model (text input - NEEDS CHANGE to model_id)
- ✅ vehicle_variant (optional)
- ✅ vehicle_fuel_type (dropdown: Petrol, Diesel, CNG, EV)
- ✅ vehicle_year (optional)
- ✅ odometer_km (recommended)

#### Service Details
- ✅ service_type (single select - NEEDS CHANGE to multi-select)
- ✅ problem_description (textarea)

#### Pickup Details
- ✅ pickup_required (checkbox)
- ✅ pickup_address (conditional)
- ✅ preferred_slot_start (datetime)

#### Meta Information
- ✅ notes (internal notes)
- ✅ lead_priority (dropdown)

---

### ❌ MISSING / NEEDS CHANGES

#### 1. Customer Details
- ❌ **city_id** - Currently using text "city", need dropdown with city IDs
- ❌ **customer_lat** - GPS latitude (required if pickup needed)
- ❌ **customer_lng** - GPS longitude (required if pickup needed)

#### 2. Vehicle Details
- ❌ **model_id** - Currently free text, need dropdown with model IDs
- ⚠️ **vehicle_make** - Should be dropdown, not free text

#### 3. Service Details (CRITICAL MISSING)
- ❌ **service_types[]** - Multi-select array (currently single select)
- ❌ **service_addons[]** - Multi-select add-ons (COMPLETELY MISSING)
- ❌ **payment_mode** - MANDATORY field (Prepaid/COD/Wallet) - **MISSING**

#### 4. Pickup Details
- ❌ **preferred_slot_end** - End time for pickup slot (MISSING)

#### 5. Other
- ❌ **coupon_code** - Optional discount code (MISSING)

---

## 🔧 REQUIRED CHANGES

### Change 1: City Selection
**Current:**
```jsx
<input type="text" name="city" />  // Free text
```

**Required:**
```jsx
<select name="city_id">  // Dropdown with city IDs
  <option value="1">Mumbai</option>
  <option value="2">Navi Mumbai</option>
  // ... fetch from cities table
</select>
```

---

### Change 2: Vehicle Make & Model
**Current:**
```jsx
<input type="text" name="vehicle_make" />
<input type="text" name="vehicle_model" />
```

**Required:**
```jsx
// Step 1: Select Make
<select name="vehicle_make" onChange={fetchModels}>
  <option value="Maruti">Maruti</option>
  <option value="Hyundai">Hyundai</option>
</select>

// Step 2: Select Model (filtered by make)
<select name="model_id">
  <option value="204">Swift VXI</option>
  <option value="205">Swift ZXI</option>
  // ... fetch from car_models table where make = selected
</select>
```

---

### Change 3: Service Types (Multi-Select)
**Current:**
```jsx
<select name="service_type">  // Single select
  <option value="GENERAL_SERVICE">General Service</option>
</select>
```

**Required:**
```jsx
// Multi-select checkboxes
<div className="service-types-grid">
  <label>
    <input type="checkbox" name="service_types" value="3" />
    General Service
  </label>
  <label>
    <input type="checkbox" name="service_types" value="12" />
    AC Service
  </label>
  // ... fetch from service_types table
</div>
```

---

### Change 4: Service Add-ons (NEW - COMPLETELY MISSING)
**Required:**
```jsx
<div className="service-addons-grid">
  <h3>Service Add-ons (Optional but Recommended)</h3>
  <label>
    <input type="checkbox" name="service_addons" value="108" />
    Semi Synthetic Oil
  </label>
  <label>
    <input type="checkbox" name="service_addons" value="202" />
    Air Filter
  </label>
  // ... fetch from service_addons or subservices table
</div>
```

---

### Change 5: Payment Mode (CRITICAL MISSING)
**Required:**
```jsx
<select name="payment_mode" required>
  <option value="">Select Payment Mode *</option>
  <option value="PREPAID">Prepaid (Pay Now)</option>
  <option value="COD">Cash on Delivery</option>
  <option value="WALLET">Wallet</option>
  <option value="UPI">UPI</option>
</select>
```

---

### Change 6: GPS Coordinates (For Pickup)
**Required:**
```jsx
{formData.pickup_required && (
  <>
    <button type="button" onClick={getCurrentLocation}>
      📍 Get Current Location
    </button>
    <input type="hidden" name="customer_lat" />
    <input type="hidden" name="customer_lng" />
    <p className="text-sm">Location: {lat}, {lng}</p>
  </>
)}
```

---

### Change 7: Pickup Slot End Time
**Current:**
```jsx
<input type="datetime-local" name="preferred_slot_start" />
```

**Required:**
```jsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>Slot Start Time *</label>
    <input type="datetime-local" name="preferred_slot_start" required />
  </div>
  <div>
    <label>Slot End Time *</label>
    <input type="datetime-local" name="preferred_slot_end" required />
  </div>
</div>
```

---

### Change 8: Coupon Code
**Required:**
```jsx
<div>
  <label>Coupon Code (Optional)</label>
  <input 
    type="text" 
    name="coupon_code" 
    placeholder="Enter coupon code"
    className="uppercase"
  />
  <button type="button" onClick={validateCoupon}>
    Validate
  </button>
</div>
```

---

## 📊 Updated Validation Rules

### Step 1: Customer Details
```jsx
✅ customer_name (required)
✅ customer_phone (required, 10-digit)
✅ customer_address (required)
✅ city_id (required) ← CHANGED from city text
```

### Step 2: Vehicle Details
```jsx
✅ vehicle_reg (optional but recommended)
✅ vehicle_make (required)
✅ model_id (required) ← CHANGED from vehicle_model text
✅ fuel_type (required)
✅ odometer_km (recommended)
```

### Step 3: Service Details
```jsx
✅ service_types[] (required, min 1 selected) ← CHANGED to array
✅ service_addons[] (optional but recommended) ← NEW
✅ problem_description (recommended)
✅ payment_mode (REQUIRED) ← NEW MANDATORY
```

### Step 4: Pickup & Additional
```jsx
✅ pickup_required (required boolean)
IF pickup_required = true:
  ✅ pickup_address (required)
  ✅ customer_lat (required) ← NEW
  ✅ customer_lng (required) ← NEW
  ✅ preferred_slot_start (required)
  ✅ preferred_slot_end (required) ← NEW
```

---

## 🔄 Updated Submit Payload

```json
{
  // Customer Details
  "customer_name": "Rahul Sharma",
  "customer_phone": "9876543210",
  "customer_phone_alt": null,
  "customer_email": null,
  "customer_address": "Sector 9, Airoli, Navi Mumbai",
  "city_id": 11,  // ← CHANGED from "city" text
  "customer_lat": 19.1234567,  // ← NEW (if pickup)
  "customer_lng": 73.0123456,  // ← NEW (if pickup)
  "contact_method": "CALL",
  
  // Vehicle Details
  "vehicle_reg": "MH43AK9876",
  "vehicle_make": "Maruti",  // Keep for display
  "model_id": 204,  // ← CHANGED from vehicle_model text
  "vehicle_variant": "VXI",
  "vehicle_year": 2020,
  "fuel_type": "PETROL",
  "odometer_km": 56000,
  
  // Service Details
  "service_types": [3, 12],  // ← CHANGED to array of IDs
  "service_addons": [108, 202],  // ← NEW array of addon IDs
  "problem_description": "Engine noise, pickup required",
  "payment_mode": "COD",  // ← NEW MANDATORY
  "coupon_code": "FIRST50",  // ← NEW optional
  
  // Pickup Details
  "pickup_required": true,
  "pickup_address": "Sector 9, Airoli",
  "preferred_slot_start": "2025-11-19T09:00:00Z",
  "preferred_slot_end": "2025-11-19T11:00:00Z",  // ← NEW
  
  // Meta
  "lead_type": "NORMAL",
  "lead_priority": "NORMAL",
  "created_from": "TELECALLER",
  "status": "NEW"
}
```

---

## 🎯 Implementation Priority

### Priority 1 (CRITICAL - Must Have)
1. ✅ Add `payment_mode` dropdown (MANDATORY)
2. ✅ Change `city` to `city_id` dropdown
3. ✅ Change `service_type` to `service_types[]` multi-select
4. ✅ Add `preferred_slot_end` field

### Priority 2 (Important - Should Have)
5. ✅ Add `model_id` dropdown (with Make → Model flow)
6. ✅ Add GPS coordinates (`customer_lat`, `customer_lng`)
7. ✅ Add `service_addons[]` multi-select

### Priority 3 (Nice to Have)
8. ✅ Add `coupon_code` field
9. ✅ Add coupon validation
10. ✅ Add auto-location detection

---

## 📝 Database Tables Needed

### To Fetch in Form:
```sql
-- Cities
SELECT id, name FROM cities WHERE is_active = true;

-- Car Makes
SELECT DISTINCT make FROM car_models;

-- Car Models (filtered by make)
SELECT id, model_name, variant FROM car_models 
WHERE make = 'Maruti';

-- Service Types
SELECT id, name, description FROM service_types 
WHERE is_active = true;

-- Service Add-ons / Sub-services
SELECT id, name, price FROM service_addons 
WHERE is_active = true;
```

---

## ✅ Final Checklist

Before lead can flow to Workshop:

### Mandatory Fields:
- [x] customer_name
- [x] customer_phone
- [x] customer_address
- [x] city_id ← FIX NEEDED
- [x] vehicle_reg
- [x] model_id ← FIX NEEDED
- [x] fuel_type
- [x] service_types[] ← FIX NEEDED
- [x] payment_mode ← MISSING
- [x] pickup_required
- [x] preferred_slot_start
- [x] preferred_slot_end ← MISSING

### Conditional (if pickup_required = true):
- [x] pickup_address
- [x] customer_lat ← MISSING
- [x] customer_lng ← MISSING

### Recommended (should collect):
- [x] service_addons[] ← MISSING
- [x] problem_description
- [x] odometer_km
- [x] coupon_code ← MISSING

---

**Status:** 🔴 Form needs updates before production use
**Estimated Time:** 4-6 hours to implement all changes
**Risk:** High - Missing mandatory fields will break workshop flow

