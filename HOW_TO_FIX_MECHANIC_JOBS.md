# How to Fix: mechanic_jobs Table Does Not Exist

## Problem
The error `relation "mechanic_jobs" does not exist` occurs because the `mechanic_jobs` table hasn't been created in your Supabase database yet.

## Root Cause
The application code references the `mechanic_jobs` table, but the database migration file `09_workshop_mechanic_enhancements.sql` was never run on your database.

## Solution

### Step 1: Create the mechanic_jobs Table

1. Open your Supabase Dashboard: https://app.supabase.com
2. Go to your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy the entire contents of the file: `database/CREATE_MECHANIC_JOBS_TABLE.sql`
6. Paste it into the SQL editor
7. Click "Run" or press Ctrl+Enter (Cmd+Enter on Mac)

### Step 2: Sync Existing Data

After creating the table, you need to backfill data for existing mechanic assignments:

1. In the SQL Editor, create another new query
2. Copy the contents of: `database/FIX_SYNC_MECHANIC_JOBS.sql`
3. Run this query to sync existing mechanic assignments

### Step 3: Verify the Fix

Run this query to check if data was inserted:

```sql
SELECT 
  mj.id,
  mj.lead_id,
  sl.lead_number,
  sl.customer_name,
  u.full_name as mechanic_name,
  mj.mechanic_status,
  mj.assigned_at
FROM mechanic_jobs mj
JOIN service_leads sl ON mj.lead_id = sl.id
JOIN users_login u ON mj.mechanic_id = u.id
ORDER BY mj.assigned_at DESC
LIMIT 10;
```

You should see the two leads mentioned:
- L-69057474 (Customer: Vijay, Vehicle: MH12JH2318)
- L-31838254 (Customer: vijay, Vehicle: mh04jw1234)

### Step 4: Test the Dashboard

1. **Web App**: Navigate to the Workshop Mechanic dashboard and verify jobs appear
2. **Mobile App**: Open the mechanic dashboard and check if assigned jobs are visible

## What This Does

1. **CREATE_MECHANIC_JOBS_TABLE.sql**:
   - Creates necessary ENUM types (`mechanic_job_status`, `job_priority`)
   - Creates the `mechanic_jobs` table with all required columns
   - Sets up indexes for better query performance
   - Configures Row Level Security (RLS) policies
   - Creates the `mechanic_dashboard` view for easy querying
   - Grants necessary permissions

2. **FIX_SYNC_MECHANIC_JOBS.sql**:
   - Inserts missing entries for leads that have `assigned_mechanic_id` set
   - Only processes leads that don't already have a `mechanic_jobs` entry
   - Handles the two specific leads you mentioned

## Expected Result

After running both SQL scripts:
- The mechanic dashboard (web and mobile) will show assigned jobs
- The two leads (L-69057474 and L-31838254) will appear for mechanic ID `7fa49f5a-08e3-428e-8e6a-f4794e827302`
- Future job assignments will automatically create `mechanic_jobs` entries

## Database Schema Changes

The `mechanic_jobs` table stores:
- Job assignments and status tracking
- Timeline information (assigned, started, completed)
- Work notes and observations
- Checklist completion status
- Media upload tracking (before/progress/after images)
- Quality assurance flags
- Performance metrics

## Alternative: Run Full Migration

If you want the complete mechanic functionality (not just the basics), you can run the full migration:

```sql
-- Run this file from the database/ folder
-- database/09_workshop_mechanic_enhancements.sql
```

This includes additional tables:
- `service_checklists` - Dynamic service checklists
- `mechanic_media` - Media uploads by mechanics
- `mechanic_parts_usage` - Parts tracking
- `mechanic_extra_work_requests` - Extra work approvals
- `mechanic_performance_metrics` - KPI tracking
- `mechanic_action_logs` - Audit trail

## Notes

- The simplified `CREATE_MECHANIC_JOBS_TABLE.sql` only creates the essential table
- For full workshop mechanic features, use `09_workshop_mechanic_enhancements.sql`
- RLS policies ensure mechanics only see their own jobs
- Supervisors and admins can see all jobs in their workshop

