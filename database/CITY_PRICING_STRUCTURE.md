# 🏙️ City-Based Pricing Structure

## Overview
Ab `workshop_service_pricing` table me **city_id** support add ho gaya hai.

---

## 📊 Updated Structure

### `workshop_service_pricing` Table

```sql
Columns:
- id (UUID)
- workshop_id (UUID) - FK to workshops
- service_type_id (UUID) - FK to service_types
- custom_price (NUMERIC) - Workshop ka custom price
- zone_id (UUID) - Optional: Zone reference
- city_id (UUID) - Optional: City reference ← NEW
- class (VARCHAR) - Optional: Vehicle class
- is_active (BOOLEAN)
- created_at, updated_at

Unique Constraint: (workshop_id, service_type_id, zone_id, city_id, class)
```

---

## 🎯 Pricing Priority (Most Specific to Least)

### Priority Order:
1. **Most Specific:** `city_id + class` (e.g., Delhi + SUV)
2. **Zone Level:** `zone_id + class` (e.g., North Zone + SUV)
3. **City Only:** `city_id` (e.g., Delhi - all classes)
4. **Zone Only:** `zone_id` (e.g., North Zone - all classes)
5. **Class Only:** `class` (e.g., SUV - all locations)
6. **Default:** No zone/city/class (applies to all)

### Example Pricing Hierarchy:
```
Workshop A + Service X:
├── Delhi (city) + SUV (class) = ₹1500  ← Most specific
├── Delhi (city) + NULL (class) = ₹1200  ← City default
├── North Zone (zone) + SUV (class) = ₹1400
├── North Zone (zone) + NULL (class) = ₹1100
├── NULL (zone) + SUV (class) = ₹1300
└── NULL (zone) + NULL (class) = ₹1000  ← Default
```

---

## 🔍 Query Examples

### Get Price for Specific City + Class:
```sql
SELECT custom_price
FROM workshop_service_pricing
WHERE workshop_id = '...'
  AND service_type_id = '...'
  AND city_id = '...'  -- Specific city
  AND class = 'SUV'    -- Specific class
LIMIT 1;
```

### Get Price with Fallback Logic:
```sql
-- Try most specific first, then fallback
SELECT custom_price
FROM workshop_service_pricing
WHERE workshop_id = '...'
  AND service_type_id = '...'
  AND (
    (city_id = '...' AND class = 'SUV') OR           -- Most specific
    (city_id = '...' AND class IS NULL) OR           -- City default
    (zone_id = '...' AND class = 'SUV') OR           -- Zone + class
    (zone_id = '...' AND class IS NULL) OR           -- Zone default
    (city_id IS NULL AND zone_id IS NULL AND class = 'SUV') OR  -- Class only
    (city_id IS NULL AND zone_id IS NULL AND class IS NULL)     -- Default
  )
ORDER BY 
  CASE WHEN city_id IS NOT NULL AND class IS NOT NULL THEN 1
       WHEN city_id IS NOT NULL THEN 2
       WHEN zone_id IS NOT NULL AND class IS NOT NULL THEN 3
       WHEN zone_id IS NOT NULL THEN 4
       WHEN class IS NOT NULL THEN 5
       ELSE 6
  END
LIMIT 1;
```

---

## 📋 Use Cases

### Use Case 1: City-Specific Pricing
```sql
-- Delhi me higher price, Mumbai me lower price
INSERT INTO workshop_service_pricing (
  workshop_id, service_type_id, city_id, custom_price
) VALUES
  ('workshop-uuid', 'service-uuid', 'delhi-uuid', 1500),
  ('workshop-uuid', 'service-uuid', 'mumbai-uuid', 1200);
```

### Use Case 2: City + Class Combination
```sql
-- Delhi me SUV ka higher price
INSERT INTO workshop_service_pricing (
  workshop_id, service_type_id, city_id, class, custom_price
) VALUES
  ('workshop-uuid', 'service-uuid', 'delhi-uuid', 'SUV', 2000),
  ('workshop-uuid', 'service-uuid', 'delhi-uuid', 'HATCHBACK', 1500);
```

### Use Case 3: Zone Default with City Override
```sql
-- North Zone default price
INSERT INTO workshop_service_pricing (
  workshop_id, service_type_id, zone_id, custom_price
) VALUES
  ('workshop-uuid', 'service-uuid', 'north-zone-uuid', 1000);

-- Delhi (in North Zone) me higher price
INSERT INTO workshop_service_pricing (
  workshop_id, service_type_id, city_id, custom_price
) VALUES
  ('workshop-uuid', 'service-uuid', 'delhi-uuid', 1200);
```

---

## 🔄 Migration Impact

### Existing Data:
- ✅ Existing records me `city_id = NULL` hoga
- ✅ Existing unique constraints automatically update ho jayenge
- ✅ No data loss

### Backward Compatibility:
- ✅ Agar `city_id = NULL` hai, to pehle jaisa kaam karega
- ✅ Zone-based pricing abhi bhi kaam karega
- ✅ Class-based pricing abhi bhi kaam karega

---

## 🎨 UI Updates Needed

### Super Admin Service Pricing Page:
1. **City Dropdown** add karna hoga (zone select ke baad)
2. **Filter by City** option
3. **Bulk City Pricing** - ek zone ke saare cities me same price

### Pricing Selection Flow:
```
1. Select Zone
   ↓
2. Select City (filtered by zone) ← NEW
   ↓
3. Select Class
   ↓
4. Select Workshop
   ↓
5. Set Prices
```

---

## 📊 Indexes Created

1. `idx_workshop_service_pricing_city` - City lookups
2. `idx_workshop_service_pricing_zone_city` - Zone + City
3. `idx_workshop_service_pricing_class_city` - Class + City
4. `idx_workshop_service_pricing_zone_city_class` - Composite
5. `idx_unique_workshop_service_zone_city_class` - Unique constraint

---

## ✅ Benefits

1. **More Granular Control:** City-level pricing
2. **Flexible Pricing:** Zone → City → Class hierarchy
3. **Backward Compatible:** Existing data kaam karega
4. **Performance:** Proper indexes for fast queries

---

## 🚀 Next Steps

1. ✅ Run migration: `36_add_city_to_service_pricing.sql`
2. ⏳ Update UI to include city selection
3. ⏳ Update pricing lookup functions
4. ⏳ Test pricing queries with city

---

**Status:** ✅ Migration Script Ready
