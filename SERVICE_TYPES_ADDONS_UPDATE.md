# Service Types & Addons Update Guide 🛠️

## 📋 Overview:
Update service types from 8 basic services to **41 comprehensive services**

---

## 🔧 What's Being Updated:

### **Service Types (41 Total):**

#### **1. Maintenance Packages (4):**
- Basic Service (15 Points)
- General Service (30 Points)
- Premium Service (50 Points)
- Platinum Service (60 Points)

#### **2. Performance Packages (5):**
- AC Performance Package
- Engine Tune Up Package
- High Performance AC Service
- Clutch Maintenance Package
- Winter Care Package

#### **3. Brake & Battery Services (5):**
- Brake Services
- Brake Booster Replacement
- Brake Cylinders Replacement
- Battery Jump Start
- Battery Charging

#### **4. Wheel & Alignment (1):**
- Complete Wheel Care (Wheel Alignment & Balancing)

#### **5. AC Services (1):**
- GAS Charging

#### **6. Cleaning & Detailing (5):**
- 360 Deep Cleaning
- Car Interior Spa
- Deep All Round Spa
- Premium Top Wash
- 3M Interior Cleaning
- 3M Exterior Cleaning

#### **7. Paint Services - Full Body (1):**
- FULL BODY PAINTING

#### **8. Paint Services - Individual Parts (14):**
- Front Bumper Paint
- Right Fender Paint
- Left Fender Paint
- Bonnet Paint
- Right Front Door Paint
- Right Rear Door Paint
- Left Front Door Paint
- Left Rear Door Paint
- Right Quarter Panel Paint
- Left Quarter Panel Paint
- Rear Bumper Paint
- Car Dicky Paint
- Roof Top Paint

#### **9. Coating Services (5):**
- 3M Wax Polish / Teflon Coating
- Nano Ceramic Coating (Single Layer)
- Nano Ceramic Coating (Double Layer)
- Antirust Under Body Coating
- Silencer Coating

---

### **Service Addons (8 Total):**

| Addon | Price | Category |
|-------|-------|----------|
| Semi Synthetic Oil | ₹500 | Engine Oil |
| Fully Synthetic Oil | ₹1,200 | Engine Oil |
| Air Filter | ₹300 | Filters |
| Cabin Filter | ₹400 | Filters |
| Fuel Filter | ₹350 | Filters |
| Engine Oil Flush | ₹250 | Engine Care |
| AC Gas Top-up | ₹600 | AC Service |
| Underbody Coating | ₹2,500 | Protection |

---

## 🚀 How to Update:

### **Step 1: Open Supabase SQL Editor**
1. Go to: https://supabase.com/dashboard
2. Select project: **MyFNG**
3. Click **SQL Editor**

### **Step 2: Run the SQL**
Copy from: `/database/update_service_types_addons.sql`

### **Step 3: Verify**
```sql
-- Check totals
SELECT COUNT(*) FROM service_types;  -- Should be 41
SELECT COUNT(*) FROM service_addons; -- Should be 8
```

---

## ✅ What Happens:

### **Existing Records (UPDATE):**
- 8 service types → Names updated to match new list
- 8 service addons → Kept as-is (already good)

### **New Records (INSERT):**
- +33 new service types added
- Addons stay at 8 (comprehensive already)

---

## 📊 Expected Results:

### **Service Types:**
```
✓ 4 Maintenance packages (15, 30, 50, 60 points)
✓ 14 Paint services (individual parts)
✓ 5 Coating services (3M, Nano, etc.)
✓ 5 Cleaning services (Spa, Deep clean)
✓ 5 Brake & Battery services
✓ 8 Other specialized services
────────────────────────────
= 41 Total Service Types
```

### **Service Addons:**
```
✓ 2 Engine oils (Semi/Fully synthetic)
✓ 3 Filters (Air/Cabin/Fuel)
✓ 3 Special services (Flush/Gas/Coating)
────────────────────────────
= 8 Total Addons
```

---

## 🎯 Usage in App:

### **Telecaller Lead Creation:**
```typescript
// Service Type Dropdown
SELECT name FROM service_types 
WHERE is_active = true 
ORDER BY name;

// Multiple selection supported
service_type_ids: [
  'uuid-basic-service',
  'uuid-ac-package',
  'uuid-brake-service'
]
```

### **Display Format:**
```
Selected Services:
✓ Basic Service (15 Points)
✓ AC Performance Package
✓ Brake Services
```

### **With Addons:**
```
Add-ons:
☐ Fully Synthetic Oil (+₹1,200)
☐ Air Filter (+₹300)
☐ AC Gas Top-up (+₹600)
```

---

## 💡 Categorization Tips:

### **For Dropdown Grouping:**
```typescript
// Group by service category
const serviceCategories = {
  'Maintenance': ['Basic', 'General', 'Premium', 'Platinum'],
  'Paint': ['Full Body', 'Bumper', 'Fender', 'Door', ...],
  'Coating': ['3M', 'Nano Ceramic', 'Antirust', ...],
  'Cleaning': ['360 Deep', 'Interior Spa', 'Top Wash', ...],
  'Performance': ['AC Package', 'Engine Tune', 'Clutch', ...]
}
```

---

## 🔄 Pricing Strategy:

### **Service Types:** 
- No fixed price (varies by vehicle)
- Workshop provides quote

### **Service Addons:**
- Fixed prices
- Add to total service cost

**Formula:**
```
Total = Service Type Quote + Selected Addons + Tax
```

---

## 📁 Files Created:

1. **SQL Script:** `/database/update_service_types_addons.sql`
2. **Documentation:** `/SERVICE_TYPES_ADDONS_UPDATE.md`

---

## ⚠️ Important Notes:

1. **Foreign Keys Safe:** Using UPDATE for existing records
2. **New UUIDs:** Auto-generated for new services
3. **Active Status:** All set to `is_active = true`
4. **Prices:** Only addons have prices, service types are quoted

---

## 🎨 UI Suggestions:

### **Service Selection Screen:**
```
┌─────────────────────────────────────┐
│ Select Service Type(s)              │
├─────────────────────────────────────┤
│ 🔧 Maintenance Packages             │
│   □ Basic Service (15 Points)       │
│   □ General Service (30 Points)     │
│   □ Premium Service (50 Points)     │
│                                     │
│ 🎨 Paint Services                   │
│   □ FULL BODY PAINTING              │
│   □ Front Bumper Paint              │
│   □ Bonnet Paint                    │
│                                     │
│ ✨ Cleaning & Detailing             │
│   □ 360 Deep Cleaning               │
│   □ Car Interior Spa                │
│                                     │
│ ⚙️ Performance Packages             │
│   □ AC Performance Package          │
│   □ Engine Tune Up Package          │
└─────────────────────────────────────┘
```

---

**Ready to update! Run the SQL file now.** 🚗🛠️

