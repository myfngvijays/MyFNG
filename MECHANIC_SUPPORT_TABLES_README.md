# Create Mechanic Support Tables

## Overview
This script creates all the supporting tables needed for mechanic workflows:

1. **mechanic_extra_work_requests** - For mechanics to request approval for additional work
2. **mechanic_performance_metrics** - Daily performance tracking for mechanics
3. **mechanic_media** - Store before/progress/after images and videos
4. **service_checklists** - Job completion checklists
5. **mechanic_parts_usage** - Track parts used in each job

## How to Run

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar

### Step 2: Run the Script
1. Copy the contents of `database/CREATE_MECHANIC_SUPPORT_TABLES.sql`
2. Paste into the SQL editor
3. Click "Run" button

### Step 3: Verify Tables Created
Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'mechanic_extra_work_requests',
  'mechanic_performance_metrics',
  'mechanic_media',
  'service_checklists',
  'mechanic_parts_usage'
);
```

You should see all 5 tables listed.

## What This Fixes

After running this script, these console errors will be resolved:
- ✅ 404 error for `mechanic_extra_work_requests`
- ✅ 404 error for `mechanic_performance_metrics`
- ✅ 404 error for `mechanic_media`
- ✅ 404 error for `service_checklists`
- ✅ 404 error for `mechanic_parts_usage`

## Features Enabled

These tables enable:
- 📸 Image upload (before/progress/after)
- ✅ Service checklists
- 🔧 Parts tracking
- 📊 Performance metrics
- 🚨 Extra work requests

All with proper RLS policies for security!

