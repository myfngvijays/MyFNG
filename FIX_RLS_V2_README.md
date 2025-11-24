# Fix RLS Policies V2 - Clean Slate Approach

## What This Does
This script completely removes all existing RLS policies from mechanic support tables and creates fresh, simple ones.

## Problem
- 406 Not Acceptable errors
- Old policies causing conflicts
- Previous policy names conflicting with new ones

## Solution
1. Disables RLS temporarily
2. Drops ALL existing policies (no conflicts!)
3. Re-enables RLS
4. Creates simple "allow all authenticated" policies

## How to Run

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar

### Step 2: Run the NEW Script
1. Copy the contents of `database/FIX_RLS_POLICIES_V2.sql`
2. Paste into the SQL editor
3. Click "Run" button

### Step 3: Verify
You should see the success message:
```
✅ RLS policies fixed! 406 errors should be resolved now.
```

### Step 4: Test
1. Go back to your web app
2. Hard refresh (Cmd+Shift+R)
3. Check console - 406 errors should be GONE! ✅

## What Changed
- ❌ Old script: Tried to drop specific policy names (caused conflicts)
- ✅ New script: Drops ALL policies dynamically (no conflicts!)

## After Running
All mechanic support tables will have open access for authenticated users:
- ✅ mechanic_performance_metrics
- ✅ service_checklists
- ✅ mechanic_extra_work_requests
- ✅ mechanic_media
- ✅ mechanic_parts_usage

No more 406 errors! 🎉

