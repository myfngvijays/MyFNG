# Mechanic Assignment - Check Status

##Problem
Mechanic assign होने के baad उसे assigned jobs में नहीं दिख रही.

## Current Flow

### 1. Assignment API
File: `/api/workshop/leads/[id]/assign-team`

चेक करते हैं कि:
- ✅ `mechanic_jobs` table में entry create हो रही है
- ✅ `service_leads` table में `assigned_mechanic_id` update हो रहा है
- ✅ Lead status update हो रहा है

### 2. Mechanic Dashboard Query
File: `/dashboard/workshop_mechanic/page.tsx`

Query करता है:
```typescript
.from('mechanic_jobs')
.select(`
  *,
  lead:service_leads(...)
`)
.eq('mechanic_id', userProfile.id)
```

### 3. Realtime Subscription
- Subscribes to `mechanic_jobs` table changes
- Filter: `mechanic_id=eq.{userProfile.id}`
- Auto-refreshes when changes happen

## Potential Issues

1. **Assignment API not creating mechanic_jobs entry correctly**
2. **Lead status not in correct state**
3. **mechanic_id mismatch**
4. **Realtime not triggering**

## Debug Steps

1. Check if `mechanic_jobs` entry is created
2. Verify `mechanic_id` matches
3. Check lead status after assignment
4. Test manual refresh vs realtime

## Files to Check
- `/apps/web/src/app/api/workshop/leads/[id]/assign-team/route.ts` (lines 100-200)
- `/apps/web/src/app/dashboard/workshop_mechanic/page.tsx` (line 129-150)

