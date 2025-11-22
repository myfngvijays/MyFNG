# 🔧 URGENT FIX - Lead Validation Database Issues

## ❌ Current Errors:
1. **Invalid enum value:** `"INCOMPLETE"` not in `lead_status` enum
2. **RLS Policy Error:** Cannot insert into `lead_activities` table

## ✅ Solution: Run SQL Migration

### 📝 Steps to Fix:

#### 1. Open Supabase Dashboard
- Go to: https://supabase.com/dashboard
- Select your project: **MyFNG**

#### 2. Open SQL Editor
- Left sidebar → Click **"SQL Editor"**
- Click **"New Query"**

#### 3. Copy & Paste Migration
Copy the entire content from: `database/FIX_LEAD_VALIDATION_ISSUES.sql`

Or copy this:
```sql
-- Add INCOMPLETE status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'INCOMPLETE' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'INCOMPLETE';
        RAISE NOTICE '✅ Added INCOMPLETE status';
    END IF;
END $$;

-- Add VALIDATED status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'VALIDATED' 
        AND enumtypid = 'lead_status'::regtype
    ) THEN
        ALTER TYPE lead_status ADD VALUE 'VALIDATED';
        RAISE NOTICE '✅ Added VALIDATED status';
    END IF;
END $$;

-- Fix RLS for lead_activities
DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON lead_activities;
DROP POLICY IF EXISTS "Allow all operations on lead_activities" ON lead_activities;

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to lead_activities"
ON lead_activities
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix RLS for lead_status_history
DROP POLICY IF EXISTS "Allow authenticated users to insert history" ON lead_status_history;
DROP POLICY IF EXISTS "Allow all operations on lead_status_history" ON lead_status_history;

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to lead_status_history"
ON lead_status_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

#### 4. Run the Query
- Click **"Run"** button (or press `Ctrl+Enter`)
- Wait for success message

#### 5. Verify
You should see success messages like:
- ✅ Added INCOMPLETE status
- ✅ Added VALIDATED status
- ✅ RLS policy updated for lead_activities
- ✅ RLS policy updated for lead_status_history

---

## 🎯 What This Fixes:

### Issue #1: Missing ENUM Values
Adds two missing statuses to `lead_status` enum:
- `INCOMPLETE` - When Lead Manager marks lead incomplete
- `VALIDATED` - When Lead Manager validates lead

### Issue #2: RLS Policy
Fixes Row-Level Security policies for:
- `lead_activities` - Activity logging table
- `lead_status_history` - Status change audit trail

Allows authenticated users to INSERT/UPDATE/DELETE records.

---

## ✅ After Running Migration:

1. **No code changes needed** - existing code will work
2. **Restart dev server** (optional, but recommended)
3. **Test again:**
   - Click "Validate Lead" ✅
   - Click "Mark Incomplete" ✅
   - Both should work without errors!

---

## 🚨 Quick Test Commands:

After migration, verify in Supabase SQL Editor:

```sql
-- Check if INCOMPLETE and VALIDATED exist
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'lead_status'::regtype 
AND enumlabel IN ('INCOMPLETE', 'VALIDATED');

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('lead_activities', 'lead_status_history');
```

Should return 2 rows for first query, and policies for second query.

---

**Status:** ⏳ Waiting for migration to run  
**Required:** Database access  
**Time:** ~30 seconds to run

