# 🔄 Website Pricing Setup - Rollback Guide

## ⚠️ Warning
Yeh script **sabhi website pricing related changes** ko permanently delete kar degi.

---

## 📋 What Will Be Dropped

### 1. **Table**
- ✅ `website_service_pricing` - Complete table with all data

### 2. **Views**
- ✅ `website_pricing_view` - Helper view

### 3. **Functions**
- ✅ `get_website_service_price()` - Price lookup function
- ✅ `update_website_pricing_updated_at()` - Trigger function

### 4. **Triggers**
- ✅ `trigger_update_website_pricing_updated_at` - Auto-update trigger

### 5. **RLS Policies**
- ✅ All 6 policies (view, insert, update, delete)

### 6. **Indexes**
- ✅ All 7 indexes (zone, city, service, unique, etc.)

### 7. **Cities Table Changes**
- ✅ `zone_id` column (if added)
- ✅ `idx_cities_zone_id` index

---

## 🚀 How to Run

### Option 1: Using psql
```bash
psql -d your_database -f database/DROP_WEBSITE_PRICING_SETUP.sql
```

### Option 2: Using Supabase SQL Editor
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the entire script
4. Run it

### Option 3: Direct SQL
```sql
\i database/DROP_WEBSITE_PRICING_SETUP.sql
```

---

## ✅ Verification

After running, verify everything is dropped:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'website_service_pricing'
);
-- Should return: false

-- Check if view exists
SELECT EXISTS (
  SELECT FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'website_pricing_view'
);
-- Should return: false

-- Check if zone_id exists in cities
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'cities' 
  AND column_name = 'zone_id'
);
-- Should return: false (if it was added)
```

---

## 🔄 Re-create Setup

Agar phir se setup karna ho, to:

```sql
-- 1. Link cities to zones (optional)
\i database/LINK_CITIES_TO_ZONES.sql

-- 2. Create website pricing table
\i database/CREATE_WEBSITE_SERVICE_PRICING.sql
```

---

## ⚠️ Important Notes

1. **Data Loss**: Yeh script **sabhi pricing data** ko permanently delete kar degi
2. **Backup**: Pehle backup le lena agar data important hai
3. **Dependencies**: Agar koi aur table is table ko reference karti hai, to pehle unhe check karein
4. **Irreversible**: Yeh action reversible nahi hai, carefully run karein

---

## 📊 Backup Before Dropping

Agar data backup chahiye:

```sql
-- Export pricing data to CSV
COPY (
  SELECT * FROM website_pricing_view
) TO '/tmp/website_pricing_backup.csv' WITH CSV HEADER;

-- Or export to JSON
SELECT json_agg(row_to_json(t)) 
FROM website_service_pricing t;
```

---

**Status:** ✅ Rollback Script Ready
