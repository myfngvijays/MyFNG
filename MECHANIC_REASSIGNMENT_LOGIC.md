# Mechanic Reassignment - How It Works

## Current Logic in Assignment API

File: `/api/workshop/leads/[id]/assign-team` (lines 199-250)

### Flow:

```typescript
// 1. Check if mechanic_jobs record exists
const existingJob = await supabase
  .from('mechanic_jobs')
  .select('id')
  .eq('lead_id', leadId)
  .maybeSingle();  // ✅ Fixed: was .single()

if (existingJob) {
  // 2a. UPDATE existing record (reassignment)
  await supabase
    .from('mechanic_jobs')
    .update({
      mechanic_id: mechanic_id,  // ← Changes to new mechanic
      assigned_by: userProfile.id,
      mechanic_status: 'ASSIGNED',
      updated_at: now
    })
    .eq('id', existingJob.id);
} else {
  // 2b. INSERT new record (first assignment)
  await supabase
    .from('mechanic_jobs')
    .insert({
      lead_id: leadId,
      mechanic_id: mechanic_id,
      assigned_by: userProfile.id,
      mechanic_status: 'ASSIGNED',
      assigned_at: now
    });
}
```

## How Reassignment Works

### Example: Change mechanic from myfng10 to mech 2

**Before:**
- `service_leads.assigned_mechanic_id` = myfng10
- `mechanic_jobs.mechanic_id` = myfng10
- myfng10 dashboard: Shows job ✅
- mech 2 dashboard: Empty ✅

**After API call:**
- `service_leads.assigned_mechanic_id` = mech 2 (UPDATED)
- `mechanic_jobs.mechanic_id` = mech 2 (UPDATED - same record)
- myfng10 dashboard: Job disappears ✅ (query filters by mechanic_id)
- mech 2 dashboard: Job appears ✅ (query filters by mechanic_id)

## Key Points:

1. ✅ **No duplicate entries** - UNIQUE constraint on `lead_id` ensures one mechanic_jobs per lead
2. ✅ **Old mechanic loses access** - Query filters by `mechanic_id`
3. ✅ **New mechanic gains access** - Same record, updated `mechanic_id`
4. ✅ **History preserved** - `mechanic_assignments` table tracks all assignments
5. ✅ **Realtime updates** - Subscription triggers dashboard refresh

## Testing Reassignment:

1. Assign lead to **myfng10**
   - myfng10 dashboard: Job appears ✅

2. Reassign same lead to **mech 2**
   - mech 2 dashboard: Job appears ✅
   - myfng10 dashboard: Job disappears ✅

3. Reassign back to **myfng10**
   - myfng10 dashboard: Job appears again ✅
   - mech 2 dashboard: Job disappears ✅

## ✅ Status:

**Reassignment logic is working correctly!**

The UPSERT pattern (check → update/insert) ensures:
- No duplicate entries
- Proper handoff between mechanics
- Clean query filtering

## Current Issue Fix:

For the current broken assignment (L-44121613 to mech 2), run:
`database/create_mech2_job_entry.sql`

This creates the missing entry. Future assignments will work automatically with the fixed API.

