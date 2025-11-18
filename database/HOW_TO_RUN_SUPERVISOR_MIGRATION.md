# 🚀 How to Run Workshop Supervisor Migration

## ⚠️ IMPORTANT: Run in This Order!

PostgreSQL requires enum values to be **committed before they can be used**. Therefore, you must run these files in 2 steps:

---

## 📋 Step-by-Step Instructions

### **Step 1: Run Enum Prerequisites** ✅

**File:** `07a_supervisor_enum_prerequisites.sql`

This file adds all necessary enum values.

#### **Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the entire contents of `07a_supervisor_enum_prerequisites.sql`
4. Paste and click **"Run"**
5. ✅ You should see: "All enum prerequisites completed successfully!"

#### **Option B: psql CLI**
```bash
psql -U postgres -d your_database -f database/07a_supervisor_enum_prerequisites.sql
```

#### **Expected Output:**
```
NOTICE: Created sla_status enum (or already exists)
NOTICE: Added HOLD to lead_status enum (or already exists)
NOTICE: Added READY_FOR_DELIVERY to lead_status enum (or already exists)
NOTICE: lead_status enum has 9 values
NOTICE: sla_status enum has 3 values
NOTICE: pickup_task_status enum has 5 values

All enum prerequisites completed successfully!
You can now run 07_workshop_supervisor_enhancements.sql
```

---

### **Step 2: Run Main Migration** ✅

**File:** `07_workshop_supervisor_enhancements.sql`

This file creates all tables, columns, indexes, functions, triggers, and views.

#### **Option A: Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the entire contents of `07_workshop_supervisor_enhancements.sql`
4. Paste and click **"Run"**
5. ✅ Success! All objects created.

#### **Option B: psql CLI**
```bash
psql -U postgres -d your_database -f database/07_workshop_supervisor_enhancements.sql
```

#### **Expected Output:**
```
CREATE TABLE (qc_checks)
CREATE TABLE (mechanic_assignments)
CREATE TABLE (supervisor_actions)
ALTER TABLE (service_leads - add columns)
ALTER TABLE (lead_extra_charges - add columns)
CREATE INDEX (17 indexes created)
CREATE FUNCTION (3 functions)
CREATE TRIGGER (3 triggers)
CREATE VIEW (supervisor_dashboard_metrics)
```

---

## ✅ Verification

After running both files, verify everything is working:

```sql
-- 1. Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('qc_checks', 'mechanic_assignments', 'supervisor_actions');

-- Expected: 3 rows

-- 2. Check columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name IN ('qc_status', 'qc_performed_by', 'ready_for_delivery_at');

-- Expected: 3 rows

-- 3. Check view exists
SELECT * FROM supervisor_dashboard_metrics LIMIT 1;

-- Expected: No error (even if no data)

-- 4. Check enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lead_status')
ORDER BY enumsortorder;

-- Expected: Should include HOLD and READY_FOR_DELIVERY
```

---

## 🎯 Quick Command Reference

### **Run Both Files in Sequence (CLI):**
```bash
# Step 1: Enum prerequisites
psql -U postgres -d your_database -f database/07a_supervisor_enum_prerequisites.sql

# Step 2: Main migration (wait a moment, then run)
psql -U postgres -d your_database -f database/07_workshop_supervisor_enhancements.sql
```

### **Run in Supabase Dashboard:**
```
1. Open SQL Editor
2. Paste 07a_supervisor_enum_prerequisites.sql → Run → Wait for success
3. Paste 07_workshop_supervisor_enhancements.sql → Run → Success!
```

---

## 🔧 Troubleshooting

### **Error: "unsafe use of new value"**
**Cause:** You tried to run the main file without running prerequisites first.  
**Fix:** Run `07a_supervisor_enum_prerequisites.sql` first, then wait a moment before running the main file.

### **Error: "enum value already exists"**
**Cause:** Enum values were already added previously.  
**Fix:** This is fine! The script handles this gracefully. Continue with the main migration.

### **Error: "relation already exists"**
**Cause:** Tables/functions already created from a previous run.  
**Fix:** The script uses `IF NOT EXISTS` clauses, so it's safe to re-run.

---

## 📊 What Gets Created

### **Enums (Step 1):**
- `sla_status` (new)
- `lead_status` (enhanced with HOLD, READY_FOR_DELIVERY)
- `pickup_task_status` (verified)

### **Tables (Step 2):**
1. `qc_checks` - Quality control records
2. `mechanic_assignments` - Assignment tracking
3. `supervisor_actions` - Action logs

### **Columns Added:**
- 10 new columns to `service_leads` and `lead_extra_charges`

### **Indexes:**
- 17 performance indexes

### **Functions & Triggers:**
- 3 automatic functions
- 3 triggers for auto-updates

### **Views:**
- `supervisor_dashboard_metrics` - Real-time dashboard data

---

## ✅ Success Criteria

After successful migration:

✅ No SQL errors  
✅ 3 new tables exist  
✅ 10 new columns added  
✅ 17 indexes created  
✅ View returns data (or no error)  
✅ Enum values include HOLD, READY_FOR_DELIVERY  

---

## 🎉 Done!

You're now ready to use all Workshop Supervisor features! 🚀

**Next Steps:**
1. ✅ Start the web application
2. ✅ Login as Workshop Supervisor
3. ✅ Access the Supervisor Dashboard
4. ✅ Start managing jobs, QC, and mechanic assignments!

---

**Need Help?** Check the error message and troubleshooting section above.

**Still Having Issues?** Ensure you're running PostgreSQL 12+ and have proper permissions.

