# Fix 406 Not Acceptable Errors

## Problem
Getting 406 errors when accessing mechanic support tables because RLS (Row Level Security) policies are too restrictive.

## Solution
Run the `FIX_RLS_POLICIES.sql` script to update the RLS policies to allow authenticated users to access the data.

## How to Run

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar

### Step 2: Run the Script
1. Copy the contents of `database/FIX_RLS_POLICIES.sql`
2. Paste into the SQL editor
3. Click "Run" button

### Step 3: Refresh Browser
1. Go back to your web app
2. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. 406 errors should be gone! ✅

## What Changed

The script updates RLS policies for these tables:
- ✅ `mechanic_performance_metrics`
- ✅ `service_checklists`
- ✅ `mechanic_extra_work_requests`
- ✅ `mechanic_media`
- ✅ `mechanic_parts_usage`

**Before:** Complex role-based policies that were blocking access
**After:** Simple authenticated user policies that work properly

## Verify It Works

After running the script, check the console - you should see:
- ✅ No more 406 errors
- ✅ Tables return empty results (200 OK) instead of errors
- ✅ Mechanic dashboard loads without errors

The tables will be empty initially, which is fine. They'll populate as mechanics start using the features.

