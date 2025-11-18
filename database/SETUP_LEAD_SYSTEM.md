# 🚀 Lead Management System - Setup Guide

## Quick Setup (5 minutes)

Follow these steps to update your database with the new lead management structure.

---

## Step 1: Run Database Migrations

### Option A: Run All at Once (Recommended)

1. Open **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Copy the contents of: `database/00_run_all_lead_migrations.sql`
5. Paste into SQL Editor
6. Click **"Run"** button (or press `Ctrl+Enter`)
7. Wait for success message ✅

### Option B: Run Individual Migrations

If you prefer to run step by step:

1. `database/01_update_service_leads_table.sql` - Updates main leads table
2. `database/02_create_lead_pricing_items.sql` - Creates pricing snapshot table
3. `database/03_update_lead_events.sql` - Updates event log table
4. `database/04_update_lead_media.sql` - Updates media table
5. `database/05_update_lead_extra_charges.sql` - Updates extra charges table

Run each file in order in Supabase SQL Editor.

---

## Step 2: Don't Forget Workshop GST Column!

If you haven't already, run:

```sql
ALTER TABLE public.workshops 
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);
```

---

## Step 3: Verify Tables

Run this query to verify all tables are updated:

```sql
-- Check service_leads columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'service_leads' 
  AND column_name IN ('service_type_ids', 'subservice_ids', 'pickup_status', 'sla_state')
ORDER BY column_name;

-- Check lead_pricing_items exists
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'lead_pricing_items';

-- Check lead_events columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'lead_events' 
  AND column_name IN ('event_category', 'actor_name', 'metadata')
ORDER BY column_name;
```

You should see:
- ✅ 4 rows for service_leads columns
- ✅ 1 for lead_pricing_items table
- ✅ 3 rows for lead_events columns

---

## Step 4: Update Frontend Code

Now that database is ready, update your application code:

### Lead Creation Form
Update to include:
- `created_from` (channel)
- `lead_priority` (priority level)
- `service_type_ids` (array)
- `pickup_required` (boolean)
- etc.

### Status Updates
Use new status flow:
NEW → ASSIGNED → ACCEPTED → IN_PROGRESS → READY_FOR_DELIVERY → DELIVERED → CLOSED

### Event Logging
Create events for every action:
```typescript
// Example event creation
await supabase
  .from('lead_events')
  .insert({
    lead_id: leadId,
    event_type: 'status_changed',
    event_category: 'STATUS',
    actor: `user:${userId}`,
    actor_name: userName,
    actor_role: userRole,
    event_description: `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: {
      old_value: oldStatus,
      new_value: newStatus
    }
  });
```

---

## Step 5: Test the System

Create a test lead and verify:

1. ✅ Lead is created with new fields
2. ✅ Pricing items are locked
3. ✅ Events are logged
4. ✅ Media can be uploaded
5. ✅ Extra charges can be requested
6. ✅ Status flow works correctly

---

## 📊 Database Files Reference

| File | Purpose |
|------|---------|
| `00_run_all_lead_migrations.sql` | Master file - runs all migrations |
| `01_update_service_leads_table.sql` | Updates core leads table |
| `02_create_lead_pricing_items.sql` | Creates pricing snapshot table |
| `03_update_lead_events.sql` | Updates activity log table |
| `04_update_lead_media.sql` | Updates media storage table |
| `05_update_lead_extra_charges.sql` | Updates extra charges table |
| `add_workshop_gst_column.sql` | Adds GST field to workshops |
| `LEAD_MANAGEMENT_STRUCTURE.md` | Complete documentation |
| `SETUP_LEAD_SYSTEM.md` | This setup guide |

---

## 🔍 Common Issues

### Issue: "Column already exists"
**Solution**: Safe to ignore. The `IF NOT EXISTS` clause prevents errors.

### Issue: "Foreign key constraint violation"
**Solution**: Make sure parent tables exist before creating child tables.

### Issue: "Permission denied"
**Solution**: Make sure you're logged into Supabase with admin privileges.

---

## ✅ Success Checklist

- [ ] Workshop GST column added
- [ ] All lead migrations run successfully
- [ ] Verification queries return expected results
- [ ] No errors in Supabase logs
- [ ] Test lead created successfully
- [ ] Frontend forms updated
- [ ] Event logging working
- [ ] Media upload working
- [ ] Extra charges workflow tested

---

## 🎉 You're Done!

Your lead management system is now set up with:

✅ Comprehensive lead tracking  
✅ Event sourcing & audit trail  
✅ Pricing snapshot system  
✅ Media management  
✅ Extra charges workflow  
✅ SLA tracking  
✅ Soft delete support  

Now you can start building the frontend features!

---

## 📚 Next Steps

1. Read `LEAD_MANAGEMENT_STRUCTURE.md` for detailed table documentation
2. Update API endpoints to use new fields
3. Create frontend forms for lead creation
4. Implement status change workflows
5. Build supervisor QC interface
6. Add pickup/delivery tracking
7. Implement SLA monitoring
8. Create reporting dashboards

---

**Need help?** Check the documentation or contact the development team.

