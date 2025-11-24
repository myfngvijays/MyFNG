# 🔧 **URGENT FIX: Mechanic Jobs Not Showing**

## ❌ **Problem:**

**2 leads assigned to mechanic but not showing in dashboard!**

- Lead 1: `L-69057474` (Vijay - MH12JH2318)
- Lead 2: `L-31838254` (vijay - mh04jw1234)
- Mechanic ID: `7fa49f5a-08e3-428e-8e6a-f4794e827302`

**Status in Database:**
- ✅ `service_leads.assigned_mechanic_id` = Set correctly
- ❌ `mechanic_jobs` table = **NO ENTRIES!**
- ❌ Dashboard = Empty (fetches from `mechanic_dashboard` view which depends on `mechanic_jobs`)

---

## 🔍 **Root Cause:**

These leads were assigned **BEFORE** the API fix was applied. The old assignment flow didn't create `mechanic_jobs` entries.

**Timeline:**
1. **Nov 20-24**: Leads assigned (old flow)
2. **Nov 24 (today)**: API fixed to create `mechanic_jobs` 
3. **Problem**: Old assignments need manual sync

---

## ✅ **SOLUTION: Run Sync SQL**

### **Option 1: Via Supabase Dashboard (RECOMMENDED)**

1. **Open Supabase Dashboard:** https://app.supabase.com
2. **Go to:** SQL Editor
3. **Copy & Paste this SQL:**

```sql
-- Sync existing mechanic assignments
INSERT INTO mechanic_jobs (
  lead_id,
  mechanic_id,
  assigned_by,
  mechanic_status,
  job_priority,
  assigned_at,
  work_notes
)
SELECT 
  sl.id,
  sl.assigned_mechanic_id,
  COALESCE(sl.assigned_by_workshop_admin_id, sl.created_by_id),
  'ASSIGNED',
  COALESCE(sl.lead_priority, 'NORMAL'),
  COALESCE(sl.mechanic_assigned_at, sl.updated_at),
  sl.internal_notes
FROM service_leads sl
WHERE 
  sl.assigned_mechanic_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mechanic_jobs mj WHERE mj.lead_id = sl.id
  )
  AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
ON CONFLICT (lead_id) DO NOTHING;

-- Verify sync
SELECT 
  sl.lead_number,
  sl.customer_name,
  mj.mechanic_status,
  '✅ Synced!' as status
FROM service_leads sl
JOIN mechanic_jobs mj ON sl.id = mj.lead_id
WHERE sl.id IN (
  '0aa93747-e720-4fad-b5f1-eb53bcead8e8',
  '94b886e6-7054-4885-b163-cb3275c2f627'
);
```

4. **Click:** Run
5. **Expected Result:**
```
lead_number   | customer_name | mechanic_status | status
--------------+---------------+-----------------+-------------
L-69057474    | Vijay         | ASSIGNED        | ✅ Synced!
L-31838254    | vijay         | ASSIGNED        | ✅ Synced!
```

---

### **Option 2: Via Terminal (psql)**

```bash
# Connect to database
psql $DATABASE_URL

# Run the sync SQL file
\i database/FIX_SYNC_MECHANIC_JOBS.sql
```

---

### **Option 3: Via Shell Script**

```bash
chmod +x fix-mechanic-sync.sh
./fix-mechanic-sync.sh
```

---

## 🧪 **Verify Fix:**

### **1. Check Database:**
```sql
SELECT 
  sl.lead_number,
  sl.customer_name,
  sl.assigned_mechanic_id,
  mj.id as mechanic_job_id,
  mj.mechanic_status
FROM service_leads sl
LEFT JOIN mechanic_jobs mj ON sl.id = mj.lead_id
WHERE sl.id IN (
  '0aa93747-e720-4fad-b5f1-eb53bcead8e8',
  '94b886e6-7054-4885-b163-cb3275c2f627'
);
```

**Expected:**
- ✅ Both leads should have `mechanic_job_id` (not null)
- ✅ `mechanic_status` should be 'ASSIGNED'

### **2. Check Dashboard:**

1. **Login as mechanic:** myfngl0
2. **Navigate to:** http://localhost:3000/dashboard/workshop_mechanic
3. **Expected:**
   - ✅ "Assigned Today: 2" (or more)
   - ✅ Job cards visible in list
   - ✅ Lead numbers showing: L-69057474, L-31838254

---

## 📊 **What This Fix Does:**

```
BEFORE Sync:
service_leads
├─ id: 0aa93747...
├─ assigned_mechanic_id: 7fa49f5a...  ✅
└─ mechanic_jobs: (empty)  ❌

mechanic_dashboard VIEW
└─ No results (view depends on mechanic_jobs)  ❌

Mechanic Dashboard
└─ "No jobs found"  ❌
```

```
AFTER Sync:
service_leads
├─ id: 0aa93747...
└─ assigned_mechanic_id: 7fa49f5a...  ✅

mechanic_jobs
├─ lead_id: 0aa93747...  ✅
├─ mechanic_id: 7fa49f5a...  ✅
└─ mechanic_status: ASSIGNED  ✅

mechanic_dashboard VIEW
├─ Lead 1: L-69057474  ✅
└─ Lead 2: L-31838254  ✅

Mechanic Dashboard
├─ Assigned Today: 2  ✅
└─ Jobs visible!  ✅
```

---

## 🔄 **For Future Assignments:**

**No manual sync needed!** The API fix (already applied) automatically creates `mechanic_jobs` entries for new assignments.

**Files Fixed:**
1. ✅ `apps/web/src/app/api/workshop/leads/[id]/assign-team/route.ts`
2. ✅ `apps/mobile/src/screens/dashboard/workshop_admin/JobAssignmentScreen.tsx`

---

## 📝 **Files in This Fix:**

1. **`database/FIX_SYNC_MECHANIC_JOBS.sql`** - Full SQL script with verification
2. **`fix-mechanic-sync.sh`** - Shell script wrapper
3. **`MECHANIC_JOBS_SYNC_FIX.md`** - This document

---

## ⚡ **Quick Command (Copy-Paste):**

```sql
INSERT INTO mechanic_jobs (lead_id, mechanic_id, assigned_by, mechanic_status, job_priority, assigned_at)
SELECT sl.id, sl.assigned_mechanic_id, COALESCE(sl.assigned_by_workshop_admin_id, sl.created_by_id), 'ASSIGNED', COALESCE(sl.lead_priority, 'NORMAL'), COALESCE(sl.mechanic_assigned_at, sl.updated_at)
FROM service_leads sl
WHERE sl.assigned_mechanic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mechanic_jobs mj WHERE mj.lead_id = sl.id) AND sl.status IN ('ASSIGNED_TO_WORKSHOP', 'TEAM_ASSIGNED', 'IN_PROGRESS', 'ACCEPTED')
ON CONFLICT (lead_id) DO NOTHING;
```

---

## 🎯 **Expected Results After Fix:**

### **Mechanic Dashboard:**
- ✅ Shows 2 jobs
- ✅ L-69057474 visible
- ✅ L-31838254 visible
- ✅ Stats updated
- ✅ Real-time data

### **Database:**
- ✅ `mechanic_jobs` has 2+ entries
- ✅ `mechanic_dashboard` view returns data
- ✅ All assignments synced

---

## 🚨 **IMPORTANT:**

**Run this sync ONCE only!** The SQL uses `ON CONFLICT DO NOTHING` to prevent duplicates, but it's best to run only once.

After this fix:
- ✅ Old assignments: Synced manually (this fix)
- ✅ New assignments: Auto-sync via API (already fixed)

---

**Status:** ⏳ **Awaiting SQL execution**  
**Time:** ~5 seconds to run  
**Impact:** ✅ **Immediate - jobs will appear in dashboard!**

---

## 📞 **Need Help?**

If sync doesn't work:
1. Check Supabase logs
2. Verify mechanic ID: `7fa49f5a-08e3-428e-8e6a-f4794e827302`
3. Check `users_login` table for mechanic user
4. Verify `mechanic_dashboard` view exists

---

**Created:** Nov 24, 2025  
**Priority:** 🔥 URGENT  
**Action:** Run SQL now to fix immediately!

