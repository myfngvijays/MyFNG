# 🚨 URGENT: DATABASE MIGRATIONS RUN KARO!

## ❌ **PROBLEM:**

Lead Manager dashboard mein **400 errors** aa rahe hain kyunki yeh columns **database mein add nahi hue hain:**

```
❌ sla_state          - Not exists
❌ reopen_count       - Not exists  
❌ is_incomplete      - Not exists
❌ workshop_id        - May not exist
```

---

## ✅ **SOLUTION: SQL MIGRATIONS RUN KARO**

### Step-by-Step Guide:

---

## 📋 **STEP 1: SUPABASE SQL EDITOR KHOLO**

```
1. Supabase dashboard kholo
2. Left sidebar mein "SQL Editor" click karo
3. "New query" button click karo
```

---

## 📋 **STEP 2: YEH MIGRATIONS RUN KARO (IN ORDER)**

### Migration 1: Lead Table Updates (SABSE IMPORTANT!)
```
File: database/00_run_all_lead_migrations.sql
```

**What it does:**
- ✅ Adds `sla_state` column
- ✅ Adds `reopen_count` column
- ✅ Adds `is_incomplete` column (if not exists)
- ✅ Adds 42 other important columns
- ✅ Creates indexes for performance

**How to run:**
```bash
1. Open: database/00_run_all_lead_migrations.sql
2. Copy ENTIRE file content
3. Paste in Supabase SQL Editor
4. Click "Run" button
5. Wait for success messages
```

---

### Migration 2: Telecaller Tables (Already Done?)
```
File: database/06_telecaller_tables.sql
```

**What it does:**
- ✅ Adds telecaller tables
- ✅ Adds telecaller columns

**Check if needed:**
```sql
-- Run this to check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'telecaller%';
```

If returns 0 rows → Run the migration

---

### Migration 3: Super Admin Tables (Already Done?)
```
File: database/08_super_admin_tables.sql
```

**What it does:**
- ✅ Adds super admin tables
- ✅ Adds system settings

---

### Migration 4: Assigned Manager Column (NEW!)
```
File: database/09_add_assigned_manager_column.sql
```

**What it does:**
- ✅ Adds `assigned_manager_id` column

---

## 🎯 **PRIORITY ORDER:**

### RUN THESE FIRST (CRITICAL):
```
1. ✅ database/00_run_all_lead_migrations.sql     (MOST IMPORTANT!)
2. ✅ database/09_add_assigned_manager_column.sql (NEW!)
```

### RUN IF NOT ALREADY DONE:
```
3. ✅ database/06_telecaller_tables.sql
4. ✅ database/08_super_admin_tables.sql
```

---

## 🔍 **HOW TO CHECK IF COLUMNS EXIST:**

### Check in Supabase:
```sql
-- Check sla_state column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'sla_state';

-- Check reopen_count column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'reopen_count';

-- Check is_incomplete column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
AND column_name = 'is_incomplete';
```

If returns 0 rows → Column doesn't exist → RUN MIGRATIONS!

---

## 📝 **DETAILED STEPS:**

### For: `database/00_run_all_lead_migrations.sql`

```bash
# Step 1: Open file
1. Open: /Users/roadserve/Downloads/MyFNG/database/00_run_all_lead_migrations.sql

# Step 2: Copy content
2. Select all (Cmd+A / Ctrl+A)
3. Copy (Cmd+C / Ctrl+C)

# Step 3: Supabase SQL Editor
4. Go to Supabase dashboard
5. Click "SQL Editor" in sidebar
6. Click "New query"
7. Paste the SQL code
8. Click "Run" button

# Step 4: Wait for completion
9. You'll see success messages like:
   ✅ "Step 1/5: Updating service_leads table..."
   ✅ "Step 2/5: Creating lead_pricing_items table..."
   ✅ etc.

# Step 5: Verify
10. Check console - no errors?
11. ✅ Success!
```

---

## ⚠️ **IMPORTANT NOTES:**

### 1. **Order Matters:**
Run `00_run_all_lead_migrations.sql` FIRST!
Other migrations depend on it.

### 2. **IF NOT EXISTS:**
All migrations use `ADD COLUMN IF NOT EXISTS`
So safe to run multiple times!

### 3. **No Data Loss:**
Migrations only ADD columns, don't DELETE anything.

### 4. **Indexes:**
Migrations also create indexes for performance.

---

## ✅ **AFTER RUNNING MIGRATIONS:**

### Test:
```bash
1. Close all browser tabs
2. Hard refresh (Ctrl+Shift+R)
3. Login as Lead Manager
4. Open dashboard
5. ✅ No 400 errors!
6. ✅ Dashboard loads!
7. ✅ All metrics show!
```

---

## 🎯 **QUICK CHECKLIST:**

```
□ Open Supabase SQL Editor
□ Run: 00_run_all_lead_migrations.sql
□ Wait for success messages
□ Run: 09_add_assigned_manager_column.sql
□ Close browser completely
□ Reopen and login
□ Test Lead Manager dashboard
□ ✅ No errors!
```

---

## 📊 **WHAT GETS ADDED:**

### From `00_run_all_lead_migrations.sql`:

**42 New Columns:**
- ✅ `created_from`
- ✅ `lead_priority`
- ✅ `city_id`
- ✅ `model_id`
- ✅ `assigned_by`
- ✅ `customer_alternate_phone`
- ✅ `customer_address`
- ✅ `customer_lat`
- ✅ `customer_lng`
- ✅ `contact_method`
- ✅ `vehicle_variant`
- ✅ `vehicle_vin`
- ✅ `vehicle_fuel_type`
- ✅ `odometer_km`
- ✅ `service_type_ids` (JSONB)
- ✅ `subservice_ids` (JSONB)
- ✅ `problem_description`
- ✅ `pickup_address`
- ✅ `pickup_lat`
- ✅ `pickup_lng`
- ✅ `pickup_otp`
- ✅ `assigned_pickup_id`
- ✅ `pickup_status`
- ✅ `preferred_slot_start`
- ✅ `preferred_slot_end`
- ✅ `payment_txn_id`
- ✅ `estimated_cost`
- ✅ `total_price`
- ✅ `coupon_code`
- ✅ `invoice_id`
- ✅ `invoice_amount`
- ✅ `audit_required`
- ✅ `audit_status`
- ✅ `audit_remarks`
- ✅ **`sla_expires_at`**
- ✅ **`sla_state`** ← THIS FIXES ERROR!
- ✅ **`reopen_count`** ← THIS FIXES ERROR!
- ✅ `escalation`
- ✅ `notes_internal`
- ✅ `attachments` (JSONB)
- ✅ `meta` (JSONB)
- ✅ `deleted_at`

**Also Creates:**
- ✅ `lead_pricing_items` table
- ✅ `lead_events` table
- ✅ `lead_media` table
- ✅ `lead_extra_charges` table
- ✅ Multiple indexes

---

## 🚨 **ERROR IF YOU DON'T RUN:**

```
400 Bad Request:
- service_leads?sla_state=eq.BREACHED
- service_leads?reopen_count=gt.0
- service_leads?is_incomplete=eq.false

Why? Column doesn't exist in database!
```

---

## ✅ **AFTER MIGRATIONS:**

```
✅ 200 OK:
- service_leads?sla_state=eq.BREACHED
- service_leads?reopen_count=gt.0
- service_leads?is_incomplete=eq.false

Why? Columns now exist!
```

---

## 🎉 **FINAL STEPS:**

```
1. Run migrations in Supabase ✅
2. Close ALL browser tabs ✅
3. Clear browser cache (optional) ✅
4. Reopen browser ✅
5. Login again ✅
6. Test dashboard ✅
7. No errors! 🎉
```

---

## 📞 **IF STILL ERRORS:**

### Check:
1. Did migrations run successfully?
2. Any error messages in SQL Editor?
3. Browser cache cleared?
4. Hard refresh done?

### Common Issues:
- **Foreign key errors** → Some referenced tables might not exist
- **Permission errors** → Use Supabase dashboard (has admin access)
- **Syntax errors** → Copy-paste entire file exactly

---

**STATUS:** 🔴 **MIGRATIONS PENDING - RUN NOW!**

**Priority:** 🚨 **URGENT - Dashboard won't work until migrations run**

**Time needed:** ⏱️ **5-10 minutes to run all**

---

**AB JALDI KARO BHAI - SUPABASE KHOLO AUR MIGRATIONS RUN KARO!** 🚀

