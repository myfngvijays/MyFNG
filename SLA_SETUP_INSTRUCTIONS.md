# SLA Time Setup for Mechanic Jobs

## What This Does
This SQL script adds automatic SLA (Service Level Agreement) tracking for mechanic jobs:

1. **Auto-calculates expected completion time** based on job priority:
   - URGENT: 2 hours
   - HIGH: 4 hours
   - NORMAL: 8 hours
   - LOW: 24 hours

2. **Dynamically calculates remaining time** in the mechanic_dashboard view

3. **Updates existing jobs** that don't have expected_completion_time set

## How to Run

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar

### Step 2: Run the Script
1. Copy the contents of `database/ADD_SLA_CALCULATION.sql`
2. Paste into the SQL editor
3. Click "Run" button

### Step 3: Verify
Run this query to check if SLA times are set:

```sql
SELECT 
  lead_id,
  job_priority,
  assigned_at,
  expected_completion_time,
  FLOOR(EXTRACT(EPOCH FROM (expected_completion_time - NOW())) / 60)::integer as sla_remaining_minutes
FROM mechanic_jobs
WHERE mechanic_status NOT IN ('COMPLETED', 'READY_FOR_DELIVERY')
ORDER BY assigned_at DESC;
```

## What You'll See on the Dashboard

After running this script:
- ✅ SLA Remaining time will show in hours and minutes
- ✅ Color-coded: Green (on time), Orange (< 1 hour), Red (overdue)
- ✅ Expected Completion time will be displayed

## Priority-Based SLA Times

| Priority | Expected Completion Time |
|----------|-------------------------|
| URGENT   | 2 hours                 |
| HIGH     | 4 hours                 |
| NORMAL   | 8 hours (default)       |

These times start from when the job is assigned to the mechanic.

