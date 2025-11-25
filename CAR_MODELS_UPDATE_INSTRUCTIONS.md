# Car Models Update Instructions 🚗

## 📋 Summary:
Replace all existing car models with new comprehensive list (168 models)

---

## ⚠️ Important Changes:

### **Schema Usage:**
- `make` → Car manufacturer (MARUTI, HYUNDAI, etc.)
- `model_name` → Car model (SWIFT, CRETA, etc.)
- `variant` → Now storing **CLASS** (HATCHBACK, SEDANS, SUV/MUVs, etc.)

### **Class Categories:**
1. `HATCHBACK` - Small cars
2. `PREMIUM HATCHBACK` - Premium small cars
3. `SEDANS` - Sedan cars
4. `COMPACT SUV` - Small SUVs
5. `SUV/MUVs` - Large SUVs
6. `PREMIUM SUV/MUVs` - Luxury SUVs
7. `PREMIUM LUXURY` - Luxury cars

---

## 🔧 Steps to Update:

### **Step 1: Open Supabase SQL Editor**
1. Go to: https://supabase.com/dashboard
2. Select project: **MyFNG**
3. Click **SQL Editor**

### **Step 2: Run the SQL File**
Copy and paste from: `/database/update_car_models.sql`

Or run this directly:

```sql
-- Delete all existing car models
DELETE FROM car_models;

-- Insert new models (168 total)
INSERT INTO car_models (make, model_name, variant, is_active) VALUES
('HYUNDAI', 'ACCENT', 'SEDANS', true),
('HONDA', 'ACCORD', 'PREMIUM LUXURY', true),
-- ... (full list in SQL file)
('TATA', 'SAFARI (OLD)', 'SUV/MUVs', true);
```

### **Step 3: Verify Update**
```sql
-- Check total count
SELECT COUNT(*) as total_models FROM car_models;
-- Expected: 168 models

-- Check by category
SELECT 
  variant as class,
  COUNT(*) as count
FROM car_models
GROUP BY variant
ORDER BY count DESC;
```

---

## 📊 Expected Results:

### **Total Models:** 168

### **By Manufacturer (Top 5):**
- MARUTI: ~25 models
- HYUNDAI: ~20 models  
- TATA: ~18 models
- MAHINDRA: ~15 models
- TOYOTA: ~12 models

### **By Class:**
- HATCHBACK: ~25
- SEDANS: ~30
- SUV/MUVs: ~35
- COMPACT SUV: ~30
- PREMIUM HATCHBACK: ~20
- PREMIUM SUV/MUVs: ~20
- PREMIUM LUXURY: ~8

---

## ✅ After Running SQL:

1. **Old Data:**
   - 12 models (Swift, Baleno, etc.)
   - ❌ Deleted

2. **New Data:**
   - 168 models
   - ✅ Added with class categories

3. **UUIDs:**
   - Auto-generated (uuid_generate_v4())
   - Unique for each model

---

## 🎯 Usage in App:

### **Frontend Dropdowns:**
```typescript
// Make dropdown
SELECT DISTINCT make FROM car_models ORDER BY make;

// Model dropdown (filtered by make)
SELECT model_name, variant as class 
FROM car_models 
WHERE make = 'MARUTI'
ORDER BY model_name;

// Display format
"MARUTI SWIFT (HATCHBACK)"
```

---

## 🚨 Important Notes:

1. **Backup First:** Export current data if needed
2. **Foreign Keys:** If `service_leads` references `car_models.id`, those will break
3. **Solution:** Use `vehicle_make` and `vehicle_model` as text fields instead

### **If Foreign Key Issues:**
```sql
-- Check if any leads reference old model IDs
SELECT COUNT(*) FROM service_leads WHERE model_id IS NOT NULL;

-- If yes, you may need to:
-- 1. Set model_id to NULL temporarily
-- 2. Update car_models
-- 3. Remap model_id based on make/model text match
```

---

## 📁 Files:

- **SQL File:** `/database/update_car_models.sql`
- **Instructions:** `/database/CAR_MODELS_UPDATE_INSTRUCTIONS.md`

---

## 🔄 Rollback (If Needed):

```sql
-- Restore old data (if you have backup)
DELETE FROM car_models;

INSERT INTO car_models (id, make, model_name, variant, is_active) VALUES
('a0000001-0001-0001-0001-000000000001', 'Maruti Suzuki', 'Swift', 'VXI', true),
-- ... old records
```

---

**Ready to update? Run the SQL file now!** 🚀

