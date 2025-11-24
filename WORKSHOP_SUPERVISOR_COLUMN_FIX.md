# Workshop Supervisor - Column Name Fix

## Problem
Workshop Supervisor pages were showing no data with error:
```
Error: column users_login.name does not exist
```

## Root Cause
All queries were using `name` column but the actual database column is `full_name`.

## Files Fixed

### 1. Main Dashboard (`page.tsx`)
- Changed mechanics query: `name` → `full_name`
- Changed jobs query: `mechanic:mechanic_id(name, ...)` → `mechanic:mechanic_id(full_name, ...)`
- Updated display: `job.mechanic?.name` → `job.mechanic?.full_name`

### 2. Job Assignments (`job-assignments/page.tsx`)
- Changed jobs query: `mechanic:mechanic_id(name, ...)` → `mechanic:mechanic_id(full_name, ...)`
- Updated display: `job.mechanic?.name` → `job.mechanic?.full_name`

### 3. Team Overview (`team-overview/page.tsx`)
- Changed team members query: `name` → `full_name`
- Updated avatar initial: `mechanic.name?.charAt(0)` → `mechanic.full_name?.charAt(0)`
- Updated display: `mechanic.name` → `mechanic.full_name`

### 4. Profile Page (`profile/page.tsx`)
- Changed form data: `userProfile.name` → `userProfile.full_name`
- Changed update query: `name: formData.name` → `full_name: formData.name`
- Updated all displays to use `full_name`

### 5. Team Performance (`team-performance/page.tsx`)
- Changed query: `.select('id, name, role')` → `.select('id, full_name, role')`
- Updated mapping: `name: member.name` → `name: member.full_name`

### 6. Extra Work Requests (`extra-work/page.tsx`)
- Changed query: `.select('name')` → `.select('full_name')`
- Updated display: `mechanic?.name` → `mechanic?.full_name`

### 7. QC Queue (`qc-queue/page.tsx`)
- Changed query: `.select('name')` → `.select('full_name')`
- Updated display: `mechanic?.name` → `mechanic?.full_name`

## Status
✅ All Workshop Supervisor pages now using correct `full_name` column
✅ Hard refresh browser to clear any cached API responses
✅ All data should now load correctly

## Testing
1. Login as Workshop Supervisor
2. Navigate to Dashboard - should show stats, mechanics, and jobs
3. Check Job Assignments - should list all jobs with mechanic names
4. Check Team Overview - should show all mechanics with their stats
5. Check Profile - should display and edit full name correctly

